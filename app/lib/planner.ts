interface GraphResponse<T> {
  value: T[];
}

interface PlannerPlan {
  id: string;
  title: string;
  owner: string;
}
export async function fetchUserTasks(userId: string, token: string) {
  const plansResponse = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/users/${userId}/planner/tasks`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!plansResponse.ok) {
    throw new Error(`Failed to fetch plans: ${plansResponse.statusText}`);
  }

  return plansResponse.json() as Promise<GraphResponse<PlannerPlan>>;
}

export async function fetchUserPlans(userId: string, token: string) {
  const plansResponse = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/users/${userId}/planner/plans`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!plansResponse.ok) {
    throw new Error(`Failed to fetch plans: ${plansResponse.statusText}`);
  }

  return plansResponse.json() as Promise<GraphResponse<PlannerPlan>>;
}

export async function fetchBucketsForPlan(planId: string, token: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/planner/plans/${planId}/buckets`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    console.warn(
      `Failed to fetch buckets for plan ${planId}: ${response.statusText}`
    );
    return [];
  }

  const data = await response.json();
  return data.value ?? [];
}

export async function fetchTasksForPlan(planId: string, token: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/planner/plans/${planId}/tasks`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!response.ok) {
    console.error(
      `Failed to fetch tasks for plan ${planId}: ${response.statusText}`
    );
    return { value: [] };
  }

  return response.json();
}
