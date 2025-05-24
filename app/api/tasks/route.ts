import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Task, User, TasksResponse } from "@/app/types";

interface PlannerPlan {
  id: string;
}

interface GraphResponse<T> {
  value: T[];
}

export async function GET(req: NextRequest) {
  const token = await getToken({ req });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');
  console.log("Fetching tasks for userId:", userId);

  if (!token?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (token.error === "RefreshAccessTokenError") {
    return NextResponse.json(
      { error: "Session expired, please sign in again" },
      { status: 401 }
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const accessToken = token.accessToken;

  try {
    // 1. Get user details
    const userResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userId}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (!userResponse.ok) {
      throw new Error(`Failed to fetch user: ${userResponse.statusText}`);
    }
    
    const userData = await userResponse.json();
    console.log("User data:", userData);

    // 2. Get user's plans
    const plansResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${userData.id}/planner/plans`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    if (!plansResponse.ok) {
      throw new Error(`Failed to fetch plans: ${plansResponse.statusText}`);
    }

    const plansData = await plansResponse.json() as GraphResponse<PlannerPlan>;
    console.log("Plans data:", plansData);

    // 3. Get tasks for each plan
    const taskResults = await Promise.all(
      plansData.value.map((plan: any) =>
        fetch(
          `https://graph.microsoft.com/v1.0/planner/plans/${plan.id}/tasks`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
          }
        ).then(async (r) => {
          if (!r.ok) {
            console.error(`Failed to fetch tasks for plan ${plan.id}: ${r.statusText}`);
            return { value: [] };
          }
          return r.json();
        })
      )
    );

    const allTasks = taskResults.flatMap((r) => (r.value ?? [])) as Task[];

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
    const userResults = await Promise.all(
      Array.from(userIds).map((id) =>
        fetch(`https://graph.microsoft.com/v1.0/users/${id}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }).then(async (r) => {
          if (!r.ok) {
            console.error(`Failed to fetch user ${id}: ${r.statusText}`);
            return null;
          }
          return r.json() as Promise<User>;
        })
      )
    );

    // 7. Create a map of user IDs to user details
    const userMap = new Map(
      userResults.filter(Boolean).map((user) => [user?.id, user])
    );

    // 8. Enhance tasks with user details
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

    // 9. Sort tasks by priority
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
