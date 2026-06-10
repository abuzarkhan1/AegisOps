import { Router } from "express";
import { asyncHandler } from "../../shared/http/asyncHandler";
import { optionalString, requiredString } from "../../shared/http/requestValidation";
import { authService } from "../platform/services/auth.service";
import { rateLimiter } from "../../shared/http/rateLimiter";

export const authRouter = Router();

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const result = await authService.register({
      email: requiredString(req.body, "email"),
      password: requiredString(req.body, "password"),
      name: optionalString(req.body, "name"),
      organizationName: optionalString(req.body, "organizationName")
    });
    res.status(201).json(result);
  })
);

authRouter.post(
  "/login",
  rateLimiter("auth-login", 5),
  asyncHandler(async (req, res) => {
    res.json(
      await authService.login({
        email: requiredString(req.body, "email"),
        password: requiredString(req.body, "password")
      })
    );
  })
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    res.json(
      await authService.refresh({
        refreshToken: optionalString(req.body, "refreshToken"),
        authorizationHeader: req.header("authorization")
      })
    );
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    await authService.logout({
      refreshToken: optionalString(req.body, "refreshToken"),
      authorizationHeader: req.header("authorization")
    });
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    res.json({ user: await authService.verifyAuthorizationHeader(req.header("authorization")) });
  })
);
