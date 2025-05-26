export async function getApplicationToken() {
  const tokenEndpoint = `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const response = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.AZURE_AD_CLIENT_ID!,
      client_secret: process.env.AZURE_AD_CLIENT_SECRET!,
      scope: `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/.default`,
      grant_type: "client_credentials",
    }),
  });

  const data = await response.json();
  return data.access_token;
}