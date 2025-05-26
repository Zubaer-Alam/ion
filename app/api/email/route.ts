import { NextRequest, NextResponse } from "next/server";

async function getApplicationToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  return data.access_token;
}

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  accessToken: string
) {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/users/tickets@theattention.network/sendMail",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          subject,
          body: {
            contentType: "HTML",
            content: html,
          },
          toRecipients: [
            {
              emailAddress: { address: to },
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }
}

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

async function getAllUsers(token: string) {
  const res = await fetch(
    "https://graph.microsoft.com/v1.0/users?$select=id,displayName,mail,userPrincipalName",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error("Failed to fetch users");
  const data = await res.json();
  return data.value; // array of users
}

export async function GET(req: NextRequest) {
  try {
    const token = await getApplicationToken();

    const summaryRes = await fetch("http://theattention.network/api/events/summary");
    const summary = await summaryRes.json();

    const htmlMessage = `
      <h3>Attention Network Event Summary</h3>
      ${formatSummaryAsHTML(summary)}
    `;

    const recipients = [
      "ayaz@theattention.network",
      "fahad@theattention.network",
      "fahim@theattention.network",
      "hersa@theattention.network",
      "Kazi@theattention.network",
      "khadem@theattention.network",
      "mashfi@theattention.network",
      "Mashkhawath@theattention.network",
      "mushfiqur@theattention.network",
      "naveed@theattention.network",
      "raiyan@theattention.network",
      "ramis@theattention.network",
      "safwan@theattention.network",
      "sarfaraj@theattention.network",
      "sayma@theattention.network",
      "Shejuti@theattention.network",
      "shishir@theattention.network",
      "yousufi@theattention.network",
      "zobaeralam@theattention.network",
    ];

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
