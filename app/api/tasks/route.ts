import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Task, User, TasksResponse } from "@/app/types";
import { getApplicationToken } from "@/app/lib/auth";
import { fetchUserDetails, fetchUsersByIds } from "@/app/lib/user";
import {
  fetchUserPlans,
  fetchBucketsForPlan,
  fetchTasksForPlan,
} from "@/app/lib/planner";

interface PlannerPlan {
  id: string;
  title: string;
  owner: string;
}

interface GraphResponse<T> {
  value: T[];
}

export async function GET(req: NextRequest) {
  const userToken = await getToken({ req });
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

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
    const token =
      userToken.email === userId
        ? userToken.accessToken
        : await getApplicationToken();

    const userData = await fetchUserDetails(userId, token);

    const plansData = await fetchUserPlans(userId, token);

    const planTitleMap = new Map(
      plansData.value.map((plan) => [plan.id, plan.title])
    );

    const allBuckets = await Promise.all(
      plansData.value.map((plan) => fetchBucketsForPlan(plan.id, token))
    );

    const bucketMap = new Map<string, string>();

    allBuckets.flat().forEach((bucket) => {
      bucketMap.set(bucket.id, bucket.name);
    });

    const taskResults = await Promise.all(
      plansData.value.map((plan) => fetchTasksForPlan(plan.id, token))
    );

    const allTasks = taskResults.flatMap((r) => r.value ?? []) as Task[];

    const userTasks = allTasks.filter(
      (task) =>
        task.assignments && Object.keys(task.assignments).includes(userData.id)
    );

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

    const userMap = await fetchUsersByIds(userIds, token);

    const enhancedTasks = userTasks.map((task: any) => {
      const plan = plansData.value.find((p) => p.id === task.planId);
      const groupId = plan?.owner;
      const tenantId = process.env.AZURE_AD_TENANT_ID;

      const teamsLink = task.id
        ? `https://tasks.office.com/theattention.network/Home/Task/${task.id}`
        : null;

      return {
        ...task,
        planName: plan?.title ?? "Unknown Plan",
        bucketName: bucketMap.get(task.bucketId) ?? "Unknown Bucket",
        teamsLink,
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
      };
    });

    // 8. Sort tasks by priority
    enhancedTasks.sort((a, b) => {
      return (b.priority ?? 0) - (a.priority ?? 0);
    });

    console.log("[ TASKS FETCHED ] :", enhancedTasks);

    const response: TasksResponse = {
      user: userData,
      tasks: enhancedTasks,
      totalTasks: enhancedTasks.length,
    };
    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error("Error fetching tasks:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
