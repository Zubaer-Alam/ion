import { User } from "@/app/types";

export async function fetchUserDetails(userId: string, token: string) {
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

export async function fetchUsersByIds(userIds: Set<string>, token: string) {
  const userResults = await Promise.all(
    Array.from(userIds).map((id) =>
      fetch(`${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/users/${id}`, {
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

  return new Map(userResults.filter(Boolean).map((user) => [user!.id, user]));
}
