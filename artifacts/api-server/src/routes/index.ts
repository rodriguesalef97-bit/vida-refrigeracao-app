import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import serviceOrdersRouter from "./serviceOrders";
import dashboardRouter from "./dashboard";
import calendarRouter from "./calendar";
import employeesRouter from "./employees";
import usersRouter from "./users";
import pushRouter from "./push";
import clientsRouter from "./clients";
import productivityRouter from "./productivity";
import awardsRouter from "./awards";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(pushRouter);
router.use(serviceOrdersRouter);
router.use(dashboardRouter);
router.use(calendarRouter);
router.use(employeesRouter);
router.use(clientsRouter);
router.use(productivityRouter);
router.use(awardsRouter);
router.use(usersRouter);

export default router;
