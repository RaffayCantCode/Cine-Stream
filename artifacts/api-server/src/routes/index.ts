import { Router, type IRouter } from "express";
import healthRouter from "./health";
import tmdbRouter from "./tmdb";
import authRouter from "./auth";
import watchHistoryRouter from "./watchHistory";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(watchHistoryRouter);
router.use(tmdbRouter);

export default router;
