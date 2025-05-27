import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { Task, TasksResponse } from "@/app/types";
import { getApplicationToken } from "@/app/lib/auth";

import { fetchUserDetails, fetchUsersByIds } from "@/app/lib/user";

import {
  fetchUserPlans,
  fetchTasksForPlan,
  fetchBucketsForPlan,
  fetchUserTasks,
} from "@/app/lib/planner";
import { recipients } from "@/recipients";

const graphFetch = async (
  endpoint: string,
  method: "GET" | "POST",
  body?: any
) => {
  const token = await getApplicationToken();
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
    throw new Error(`Graph API request failed: ${response.statusText}`);
  }

  return response.json();
};

export async function GET() {
  try {
    const token = await getApplicationToken();
    const email = "khadem@theattention.network";
    const allTasks = await fetchUserTasks(email, token);

    // return NextResponse.json(allTasks);

    // 1. Extract only the unique IDs that actually exist in your tasks
    const uniquePlanIds = [
      ...new Set(allTasks.value.map((task) => task.planId)),
    ];
    const uniqueBucketIds = [
      ...new Set(allTasks.value.map((task) => task.bucketId)),
    ];

    // 2. Use $batch to fetch ONLY the needed plan and bucket names
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

    // 3. Single batch API call
    const batchResponse = await graphFetch("/$batch", "POST", {
      requests: batchRequests,
    });

    const planNameMap = new Map();
    const bucketNameMap = new Map();

    batchResponse.responses.forEach((response) => {
      if (response.status === 200) {
        if (response.body.title) {
          // It's a plan
          planNameMap.set(response.body.id, response.body.title);
        } else if (response.body.name) {
          // It's a bucket
          bucketNameMap.set(response.body.id, response.body.name);
        }
      }
    });

    // console.log("Plan names:", planNameMap);
    // console.log("Bucket names:", bucketNameMap);

    // 5. Enhance tasks with names
    const enhancedTasks = allTasks.value.map((task) => ({
      ...task,
      planName: planNameMap.get(task.planId) || "Unknown Plan",
      bucketName: bucketNameMap.get(task.bucketId) || "Unknown Bucket",
    }));

    return NextResponse.json(enhancedTasks);
  } catch (error: unknown) {
    console.error("Error fetching tasks:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to fetch tasks";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
function convertTasksToCSV(allTasks: { user: string; task: Task }[]) {
  throw new Error("Function not implemented.");
}
