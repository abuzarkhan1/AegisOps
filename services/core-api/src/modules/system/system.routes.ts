import { Router } from "express";
import { openApiSpec } from "../../api/openapi";

export const systemRouter = Router();

systemRouter.get(["/openapi.json", "/docs/openapi.json"], (_req, res) => {
  res.json(openApiSpec);
});
