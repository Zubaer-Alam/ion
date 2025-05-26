import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Task, User, TasksResponse } from "@/app/types";

interface PlannerPlan {
  id: string;
}

interface GraphResponse<T> {
  value: T[];
}

async function getApplicationToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;
  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials'
    })
  });
  const data = await response.json();
  return data.access_token;
}

async function fetchUserDetails(userId: string, token: string) {
  const userResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userId)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  
  if (!userResponse.ok) {
    throw new Error(`Failed to fetch user: ${userResponse.statusText}`);
  }
  return userResponse.json();
}

async function fetchUserPlans(userId: string, token: string) {
  const plansResponse = await fetch(
    `https://graph.microsoft.com/v1.0/users/${userId}/planner/plans`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!plansResponse.ok) {
    throw new Error(`Failed to fetch plans: ${plansResponse.statusText}`);
  }

  return plansResponse.json() as Promise<GraphResponse<PlannerPlan>>;
}

async function fetchTasksForPlan(planId: string, token: string) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/planner/plans/${planId}/tasks`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    console.error(`Failed to fetch tasks for plan ${planId}: ${response.statusText}`);
    return { value: [] };
  }

  return response.json();
}

async function fetchUsersByIds(userIds: Set<string>, token: string) {
  const userResults = await Promise.all(
    Array.from(userIds).map((id) =>
      fetch(`https://graph.microsoft.com/v1.0/users/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async (r) => {
        if (!r.ok) {
          console.error(`Failed to fetch user ${id}: ${r.statusText}`);
          return null;
        }
        return r.json() as Promise<User>;
      })
    )
  );

  return new Map(
    userResults.filter(Boolean).map((user) => [user!.id, user])
  );
}

export async function GET(req: NextRequest) {
  const userToken = await getToken({ req });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userToken?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (userToken.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Session expired, please sign in again" },
      { status: 401 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  try {
    // Determine which token to use
    const token = userToken.email === userId 
      ? userToken.accessToken  // Use delegated token for own tasks
      : await getApplicationToken();  // Use application token for others' tasks
      console.log("Using token:", userToken.email === userId ? "delegated" : "application");

      console.log("Using token for user:", userId);

    // 1. Get user details
    const userData = await fetchUserDetails(userId, token);

    // 2. Get user's plans
    const plansData = await fetchUserPlans(userId, token);

    // 3. Get tasks for each plan
    const taskResults = await Promise.all(
      plansData.value.map(plan => fetchTasksForPlan(plan.id, token))
    );

    const allTasks = taskResults.flatMap((r) => (r.value ?? [])) as Task[];

    // 4. Filter tasks assigned to the user
    const userTasks = allTasks.filter(
      (task) => task.assignments && Object.keys(task.assignments).includes(userData.id)
    );

    console.log("User tasks filtered:", userTasks.length);

    // 5. Get unique user IDs from filtered tasks
    const userIds = new Set<string>();
    userTasks.forEach((task: any) => {
      if (task.createdBy?.user?.id) {
        userIds.add(task.createdBy.user.id);
      }
      if (task.assignments) {
        Object.keys(task.assignments).forEach((id) => {
          userIds.add(id);
        });
      }
    });

    // 6. Fetch details for all involved users
    const userMap = await fetchUsersByIds(userIds, token);

    // 7. Enhance tasks with user details
    const enhancedTasks = userTasks.map((task: any) => ({
      ...task,
      createdBy: task.createdBy?.user?.id
        ? {
            ...task.createdBy,
            user: userMap.get(task.createdBy.user.id),
          }
        : task.createdBy,
      assignedTo: task.assignments
        ? Object.keys(task.assignments)
            .map((id) => userMap.get(id))
            .filter(Boolean)
        : [],
    }));

    // 8. Sort tasks by priority
    enhancedTasks.sort((a, b) => {
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    const response: TasksResponse = {
      user: userData,
      tasks: enhancedTasks,
      totalTasks: enhancedTasks.length,
    };
    
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Error fetching tasks:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
