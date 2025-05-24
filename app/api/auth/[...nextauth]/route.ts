import NextAuth from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";
import { NextAuthOptions, Session } from "next-auth";
import { JWT } from "next-auth/jwt";

interface CustomSession extends Session {
  accessToken?: string;
  error?: string;
}

interface Token extends JWT {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  error?: string;
}

async function refreshAccessToken(token: Token) {
  try {
    const response = await fetch(
      `https://login.microsoftonline.com/${process.env.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams([
          ["client_id", process.env.AZURE_AD_CLIENT_ID!],
          ["client_secret", process.env.AZURE_AD_CLIENT_SECRET!],
          ["grant_type", "refresh_token"],
          ["refresh_token", token.refreshToken!],
        ]).toString(),
      }
    );

    const refreshedToken = await response.json();

    if (!response.ok) {
      throw refreshedToken;
    }

    return {
      ...token,
      accessToken: refreshedToken.access_token,
      refreshToken: refreshedToken.refresh_token ?? token.refreshToken,
      expiresAt: Date.now() + refreshedToken.expires_in * 1000,
    };
  } catch (error) {
    console.error("Error refreshing access token", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: {
        params: {
          scope:
            "openid profile email offline_access User.Read.All Tasks.Read Group.Read.All",

          // scope: "openid profile email offline_access User.Read Tasks.Read Group.Read.All",
        },
      },
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, account }): Promise<Token> {
      if (account) {
        // Initial sign in
        const newToken: Token = {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          expiresAt: (account.expires_at || 0) * 1000, // Convert to milliseconds
        };
        return newToken;
      }

      // Return previous token if the access token has not expired
      const expiresAt = token.expiresAt as number | undefined;
      if (expiresAt && Date.now() < expiresAt) {
        return token;
      }

      // Access token has expired, try to refresh it
      return refreshAccessToken(token);
    },
    async session({
      session,
      token,
    }: {
      session: Session;
      token: Token;
    }): Promise<CustomSession> {
      const customSession: CustomSession = {
        ...session,
        accessToken: token.accessToken as string | undefined,
        error: token.error,
      };
      return customSession;
    },
  },
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
