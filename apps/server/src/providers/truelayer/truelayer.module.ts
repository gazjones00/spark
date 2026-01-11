import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { TRUELAYER_MODULE_OPTIONS } from "./truelayer.constants";
import type {
  TruelayerModuleOptions,
  TruelayerModuleAsyncOptions,
  TruelayerOptionsFactory,
} from "./truelayer.interfaces";
import { TruelayerClient } from "./truelayer.client";
import { TruelayerService } from "./truelayer.service";

@Module({})
export class TruelayerModule {
  static forRoot(options: TruelayerModuleOptions): DynamicModule {
    return {
      module: TruelayerModule,
      global: true,
      providers: [
        {
          provide: TRUELAYER_MODULE_OPTIONS,
          useValue: options,
        },
        TruelayerClient,
        TruelayerService,
      ],
      exports: [TruelayerClient, TruelayerService],
    };
  }

  static forRootAsync(options: TruelayerModuleAsyncOptions): DynamicModule {
    return {
      module: TruelayerModule,
      global: true,
      imports: options.imports ?? [],
      providers: [...this.createAsyncProviders(options), TruelayerClient, TruelayerService],
      exports: [TruelayerClient, TruelayerService],
    };
  }

  private static createAsyncProviders(options: TruelayerModuleAsyncOptions): Provider[] {
    if (options.useExisting || options.useClass) {
      return [this.createAsyncOptionsProvider(options)];
    }

    return [
      this.createAsyncOptionsProvider(options),
      ...(options.useClass
        ? [
            {
              provide: options.useClass,
              useClass: options.useClass,
            },
          ]
        : []),
    ];
  }

  private static createAsyncOptionsProvider(options: TruelayerModuleAsyncOptions): Provider {
    if (options.useFactory) {
      return {
        provide: TRUELAYER_MODULE_OPTIONS,
        useFactory: options.useFactory,
        inject: options.inject ?? [],
      };
    }

    const inject = options.useExisting ?? options.useClass;

    return {
      provide: TRUELAYER_MODULE_OPTIONS,
      useFactory: async (optionsFactory: TruelayerOptionsFactory) =>
        optionsFactory.createTruelayerOptions(),
      inject: inject ? [inject] : [],
    };
  }
}
