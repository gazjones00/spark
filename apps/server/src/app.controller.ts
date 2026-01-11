import { Controller } from "@nestjs/common";
import { Implement, implement } from "@orpc/nest";
import { AppService } from "./app.service";
import { contract } from "@spark/orpc/contract";

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Implement(contract.health)
  health() {
    return implement(contract.health).handler(() => {
      return { message: this.appService.getHello() };
    });
  }
}
