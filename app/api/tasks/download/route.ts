import { NextResponse } from "next/server";
import { getApplicationToken } from "@/app/lib/auth";
import { fetchUserTasks } from "@/app/lib/planner";
import { recipients } from "@/recipients"; // array of email strings
import { format } from "date-fns";

// Get SharePoint site and drive info
const getSiteAndDriveInfo = async (token: string) => {
  const hostname = "theattentionnetwork.sharepoint.com";
  const sitePath = "sites/TheAttentionNetwork";

  // Get site info
  const siteResponse = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/sites/${hostname}:/${sitePath}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!siteResponse.ok) {
    console.error(
      `Failed to get site info: ${siteResponse.status} ${siteResponse.statusText}`
    );
    const errorText = await siteResponse.text();
    console.error("Error details:", errorText);
    throw new Error(`Failed to get site info: ${siteResponse.statusText}`);
  }

  const siteData = await siteResponse.json();
  if (!siteData.id) {
    throw new Error("Site ID not found in response");
  }

  // Get drive info
  const driveResponse = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/sites/${siteData.id}/drives`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!driveResponse.ok) {
    console.error(
      `Failed to get drive info: ${driveResponse.status} ${driveResponse.statusText}`
    );
    const errorText = await driveResponse.text();
    console.error("Error details:", errorText);
    throw new Error(`Failed to get drive info: ${driveResponse.statusText}`);
  }

  const driveData = await driveResponse.json();
  const documentsDrive = driveData.value.find(
    (drive: any) => drive.name === "Documents"
  );
  if (!documentsDrive?.id) {
    throw new Error("Documents drive not found");
  }

  return {
    siteId: siteData.id,
    driveId: documentsDrive.id,
  };
};

// Create Excel session
const createExcelSession = async (token: string) => {
  const driveId =
    "b!8ji68CpjS0Kf6NenHWESHBo5R9D_mTpPgBWbFcYLN9-qFPbdA83QSbv478vLkVs8";
  const siteId =
    "theattentionnetwork.sharepoint.com,f0ba38f2-632a-424b-9fe8-d7a71d61121c,d047391a-99ff-4f3a-8015-9b15c60b37df";
  const fileId = "01LQIQI5LBHBZHGX6JCBAL72VECZ6YYWHB";

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/sites/${siteId}/drives/${driveId}/items/${fileId}/workbook/createSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ persistChanges: true }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to create Excel session:", errorText);
    throw new Error("Failed to create Excel session");
  }

  const data = await response.json();
  return data.id;
};

// Excel API utility
const excelFetch = async (
  endpoint: string,
  method: "GET" | "POST" | "PATCH",
  body?: any,
  sessionId?: string
) => {
  const token = await getApplicationToken();
  const driveId =
    "b!8ji68CpjS0Kf6NenHWESHBo5R9D_mTpPgBWbFcYLN9-qFPbdA83QSbv478vLkVs8";
  const siteId =
    "theattentionnetwork.sharepoint.com,f0ba38f2-632a-424b-9fe8-d7a71d61121c,d047391a-99ff-4f3a-8015-9b15c60b37df";
  const fileId = "01LQIQI5LBHBZHGX6JCBAL72VECZ6YYWHB";

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/sites/${siteId}/drives/${driveId}/items/${fileId}/workbook${endpoint}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(sessionId && { "workbook-session-id": sessionId }),
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    console.error(
      `Excel API request failed: ${response.status} ${response.statusText}`
    );
    const errorText = await response.text();
    console.error("Excel API Error details:", errorText);
    console.error("Request details:", {
      endpoint,
      method,
      bodyPreview: body ? JSON.stringify(body).slice(0, 200) : "No body",
    });
    throw new Error(`Excel API request failed: ${response.statusText}`);
  }

  try {
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Failed to parse Excel API response:", error);
    throw new Error("Invalid response from Excel API");
  }
};

// Helper to map priority number to text
const getPriorityText = (priority: number): string => {
  if (priority <= 3) return "High";
  if (priority <= 6) return "Medium";
  return "Low";
};

// Helper to format date for Excel
const formatDate = (date: string | null): string => {
  if (!date) return "";
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
};

// Helper to create Excel worksheet
const createOrUpdateWorksheet = async (
  token: string,
  worksheetName: string,
  tasks: any[]
) => {
  try {
    const sessionId = await createExcelSession(token);
    const worksheets = await excelFetch(
      "/worksheets",
      "GET",
      undefined,
      sessionId
    );
    const exists = worksheets.value.some((w: any) => w.name === worksheetName);

    if (!exists) {
      await excelFetch(
        "/worksheets",
        "POST",
        {
          name: worksheetName,
        },
        sessionId
      );
    }

    // // Clear existing content
    // await excelFetch(`/worksheets/${worksheetName}/range`, "PATCH", {
    //   values: [[]], // Empty array to clear content
    // }, sessionId);

    // Add headers
    const headers = [
      "Status",
      "Priority",
      "Plan",
      "Bucket",
      "Title",
      "Due Date",
      "Created Date",
      "Completed Date",
      "Active",
      "Total",
    ];

    // Write headers and data in one go
    const rows = [
      headers,
      ...tasks.map((task) => [
        `${task.percentComplete}%`,
        task.priority,
        task.planName,
        task.bucketName,
        task.title,
        formatDate(task.dueDateTime),
        formatDate(task.createdDateTime),
        formatDate(task.completedDateTime),
        task.activeChecklistItemCount,
        task.checklistItemCount,
      ]),
    ];

    await excelFetch(
      `/worksheets/${worksheetName}/range(address='A1:J${rows.length}')`,
      "PATCH",
      {
        values: rows,
      },
      sessionId
    );

    return true;
  } catch (error) {
    console.error("Error updating Excel worksheet:", error);
    return false;
  }
};

// Graph API utility
const graphFetch = async (
  endpoint: string,
  method: "GET" | "POST",
  body?: any,
  token?: string
) => {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0${endpoint}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    }
  );

  if (!response.ok) {
    console.error(response);
    throw new Error(`Graph API request failed: ${response.statusText}`);
  }

  return response.json();
};

export async function GET() {
  let excelStatus = false;
  try {
    const token = await getApplicationToken();
    const today = format(new Date(), "yyyy-MM-dd");

    const userTasks: { user: string; task: any }[] = [];

    const taskPromises = recipients.map(async (email) => {
      try {
        const tasksRes = await fetchUserTasks(email, token);
        return tasksRes.value.map((task: any) => ({ user: email, task }));
      } catch (err) {
        console.error(`Failed to fetch tasks for ${email}`, err);
        return [];
      }
    });

    const allUserTasks = await Promise.all(taskPromises);
    userTasks.push(...allUserTasks.flat());

    const uniquePlanIds = [...new Set(userTasks.map((t) => t.task.planId))];
    const uniqueBucketIds = [...new Set(userTasks.map((t) => t.task.bucketId))];

    // Step 3: Create $batch requests
    const batchRequests = [
      ...uniquePlanIds.map((planId) => ({
        id: `${planId}`,
        method: "GET",
        url: `/planner/plans/${planId}?$select=id,title`,
      })),

      ...uniqueBucketIds.map((bucketId) => ({
        id: `${bucketId}`,
        method: "GET",
        url: `/planner/buckets/${bucketId}?$select=id,name`,
      })),
    ];

    // Step 4: Send $batch request
    const batchResponse = await graphFetch(
      "/$batch",
      "POST",
      {
        requests: batchRequests,
      },
      token
    );

    // Step 5: Map responses
    const planNameMap = new Map<string, string>();
    const bucketNameMap = new Map<string, string>();

    batchResponse.responses.forEach((res: any) => {
      if (res.status === 200) {
        const { id, title, name } = res.body;
        if (title) planNameMap.set(id, title);
        if (name) bucketNameMap.set(id, name);
      }
    });

    // Step 6: Enhance tasks
    const enhancedTasks = userTasks.map(({ user, task }) => ({
      user,
      ...task,
      planName: planNameMap.get(task.planId) || "Unknown Plan",
      bucketName: bucketNameMap.get(task.bucketId) || "Unknown Bucket",
    }));

    // After enhancing tasks, update Excel
    try {
      excelStatus = await createOrUpdateWorksheet(token, today, enhancedTasks);
    } catch (error) {
      console.error("Error updating Excel:", error);
      console.error(
        "Stack trace:",
        error instanceof Error ? error.stack : "No stack trace"
      );
    }

    return NextResponse.json({
      updated: excelStatus,
      worksheet: today,
    });
  } catch (error: unknown) {
    console.error("Error fetching all user tasks:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json(errorMessage);
  }
}
