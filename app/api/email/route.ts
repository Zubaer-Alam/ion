import { NextRequest, NextResponse } from "next/server";
import { getApplicationToken } from "@/app/lib/auth";
import { sendEmail } from "@/app/lib/email";
import { recipients } from "@//recipients";

function formatSummaryAsHTML(events: any[]) {
  return `
    <style>
      table {
        width: 100%;
        border-collapse: collapse;
        font-family: Arial, sans-serif;
        font-size: 14px;
      }
      th, td {
        text-align: left;
        padding: 12px;
        border-bottom: 1px solid #ddd;
      }
      th {
        background-color: #f5f5f5;
      }
      .low {
        color: #d32f2f; /* red */
        font-weight: bold;
      }
      .medium {
        color: #f9a825; /* amber */
        font-weight: bold;
      }
      .high {
        color: #388e3c; /* green */
        font-weight: bold;
      }
      .footer {
        margin-top: 20px;
        font-size: 13px;
        color: #666;
      }
    </style>

    

    <table>
      <thead>
        <tr>
          <th> Event</th>
          <th> ETA</th>
          <th> Capacity</th>
          <th> Sold</th>
          <th> Sold %</th>
        </tr>
      </thead>
      <tbody>
        ${events
          .map((event) => {
            const percent = event.percentage;
            let soldClass = "medium";
            if (percent < 30) soldClass = "low";
            else if (percent >= 80) soldClass = "high";

            return `
            <tr>
              <td>${event.event}</td>
              <td>${event.eta}</td>
              <td>${event.capacity}</td>
              <td class="${soldClass}">${event.sold}</td>
              <td class="${soldClass}">${percent}%</td>
            </tr>
          `;
          })
          .join("")}
      </tbody>
    </table>

    <div class="footer">
      Showing ${events.length} upcoming ${
    events.length === 1 ? "event" : "events"
  }.
    </div>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const token = await getApplicationToken();

    const summaryRes = await fetch(
      "https://theattention.network/api/events/summary"
    );
    const summary = await summaryRes.json();

    const htmlMessage = `
      <h3>Attention Network Event Summary</h3>
      ${formatSummaryAsHTML(summary)}
    `;

    for (const email of recipients) {
      try {
        await sendEmail(email, "🎟️ Daily Event Summary", htmlMessage, token);
        console.log(`✅ Email sent to ${email}`);
      } catch (err: any) {
        console.warn(`❌ Failed to send email to ${email}:`, err.message);
      }
    }

    return NextResponse.json({ status: "Email sent." });
  } catch (error: any) {
    console.error("Email send error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
