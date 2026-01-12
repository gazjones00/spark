import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Inject, Module, type OnModuleInit } from "@nestjs/common";
import { HttpAdapterHost } from "@nestjs/core";
import { env } from "@spark/env/server";
import type { Express, NextFunction, Request, Response } from "express";
import type { BullMQDriver } from "../message-queue";

function basicAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Basic ")) {
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    res.status(401).send("Authentication required");
    return;
  }

  const base64Credentials = authHeader.slice(6);
  const credentials = Buffer.from(base64Credentials, "base64").toString("utf-8");
  const [username, password] = credentials.split(":");

  if (username === env.BULL_BOARD_USERNAME && password === env.BULL_BOARD_PASSWORD) {
    next();
  } else {
    res.setHeader("WWW-Authenticate", 'Basic realm="Bull Board"');
    res.status(401).send("Invalid credentials");
  }
}

export const BULL_BOARD_DRIVER = Symbol("bull-board:driver");

@Module({})
export class BullBoardModule implements OnModuleInit {
  constructor(
    private adapterHost: HttpAdapterHost,
    @Inject(BULL_BOARD_DRIVER) private driver: BullMQDriver,
  ) {}

  static forRoot(driver: BullMQDriver) {
    return {
      module: BullBoardModule,
      providers: [
        {
          provide: BULL_BOARD_DRIVER,
          useValue: driver,
        },
      ],
    };
  }

  onModuleInit() {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath("/queues");

    const queues = this.driver.getQueues();

    createBullBoard({
      queues: queues.map((queue) => new BullMQAdapter(queue)),
      serverAdapter,
    });

    const app = this.adapterHost.httpAdapter.getInstance<Express>();
    app.use("/queues", basicAuthMiddleware, serverAdapter.getRouter());
  }
}
