export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  accessToken: string
) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_GRAPH_API_ENDPOINT}/v1.0/users/tickets@theattention.network/sendMail`,
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