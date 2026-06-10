import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../../../config/env";
import { HttpError } from "../../../shared/http/errors";
import { createSecret, sha256 } from "../../../shared/security/crypto";
import { platformRepository } from "../repositories/platform.repository";
import type { AuthUser, UserRole } from "../types/platform.types";

type TokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

const signToken = (payload: TokenPayload) =>
  jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN
  });

const refreshExpiry = () => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRES_IN_DAYS);
  return expiresAt;
};

export class AuthService {
  private async issueSession(user: AuthUser) {
    const refreshToken = createSecret("rfr");
    await platformRepository.createRefreshToken({
      userId: user.id,
      tokenHash: sha256(refreshToken),
      expiresAt: refreshExpiry()
    });

    return {
      user: platformRepository.toPublicUser(user),
      accessToken: signToken({ sub: user.id, email: user.email, role: user.role }),
      refreshToken
    };
  }

  async register(input: { email: string; password: string; name?: string; organizationName?: string }) {
    const existing = await platformRepository.findUserByEmail(input.email);
    if (existing) {
      throw new HttpError(409, "Email is already registered");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await platformRepository.createUser({
      email: input.email,
      name: input.name ?? input.email.split("@")[0],
      passwordHash,
      role: "owner"
    });
    const organization = await platformRepository.createOrganization({
      name: input.organizationName ?? `${user.name}'s Organization`,
      ownerId: user.id
    });

    return {
      ...(await this.issueSession(user)),
      organization,
    };
  }

  async login(input: { email: string; password: string }) {
    const user = await platformRepository.findUserByEmail(input.email);
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const validPassword = await bcrypt.compare(input.password, user.passwordHash);
    if (!validPassword) {
      throw new HttpError(401, "Invalid email or password");
    }

    if (user.status !== "active") {
      throw new HttpError(403, "User is inactive");
    }

    return this.issueSession(user);
  }

  async verifyAuthorizationHeader(header?: string) {
    if (!header) {
      throw new HttpError(401, "Missing authorization header");
    }
    const token = header.replace(/^Bearer\s+/i, "");
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as TokenPayload;
      const user = await platformRepository.findUserById(decoded.sub);
      if (!user) {
        throw new HttpError(401, "User no longer exists");
      }
      if (user.status !== "active") {
        throw new HttpError(403, "User is inactive");
      }
      return platformRepository.toPublicUser(user);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(401, "Invalid or expired token");
    }
  }

  async refresh(input: { refreshToken?: string; authorizationHeader?: string }) {
    if (!input.refreshToken) {
      const user = await this.verifyAuthorizationHeader(input.authorizationHeader);
      return {
        user,
        accessToken: signToken({ sub: user.id, email: user.email, role: user.role })
      };
    }

    const tokenHash = sha256(input.refreshToken);
    const storedToken = await platformRepository.findActiveRefreshToken(tokenHash);
    if (!storedToken) {
      throw new HttpError(401, "Invalid or expired refresh token");
    }

    const user = await platformRepository.findUserById(storedToken.userId);
    if (!user || user.status !== "active") {
      throw new HttpError(401, "Invalid refresh token");
    }

    await platformRepository.revokeRefreshToken(tokenHash);
    return this.issueSession(user);
  }

  async logout(input: { refreshToken?: string; authorizationHeader?: string }) {
    if (input.refreshToken) {
      await platformRepository.revokeRefreshToken(sha256(input.refreshToken));
      return;
    }

    const user = await this.verifyAuthorizationHeader(input.authorizationHeader).catch(() => undefined);
    if (user) {
      await platformRepository.revokeUserRefreshTokens(user.id);
    }
  }
}

export const authService = new AuthService();
