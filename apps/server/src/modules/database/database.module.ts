import { Global, Module } from "@nestjs/common";
import { db } from "@spark/db/client";
import { DATABASE_CONNECTION } from "./constants";

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useValue: db,
    },
  ],
  exports: [DATABASE_CONNECTION],
})
export class DatabaseModule {}
