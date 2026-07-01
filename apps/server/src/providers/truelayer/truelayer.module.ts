import { type DynamicModule, Module, type Provider } from "@nestjs/common";
import { TRUELAYER_MODULE_OPTIONS } from "./truelayer.constants";
import type {
  TruelayerModuleOptions,
  TruelayerModuleAsyncOptions,
  TruelayerOptionsFactory,
} from "./truelayer.interfaces";
import { ConnectorsModule } from "../../modules/connectors";
import { TruelayerClient } from "./truelayer.client";
import { TruelayerConnectionService } from "./truelayer.connection.service";
import { TruelayerService } from "./truelayer.service";
import { TruelayerAccountStatusService } from "./truelayer-account-status.service";
import { TruelayerConnectorTokenService } from "./truelayer-connector-token.service";

const PROVIDERS = [
  TruelayerClient,
  TruelayerConnectionService,
  TruelayerService,
  TruelayerAccountStatusService,
  TruelayerConnectorTokenService,
];

@Module({})
export class TruelayerModule {
  static forRoot(options: TruelayerModuleOptions): DynamicModule {
    return {
      module: TruelayerModule,
      global: true,
      // TruelayerService routes new connections through the connector path
      // (ConnectorConnectionService) — see docs/adr/0001.
      imports: [ConnectorsModule],
      providers: [
        {
          provide: TRUELAYER_MODULE_OPTIONS,
          useValue: options,
        },
        ...PROVIDERS,
      ],
      exports: PROVIDERS,
    };
  }

  static forRootAsync(options: TruelayerModuleAsyncOptions): DynamicModule {
    return {
      module: TruelayerModule,
      global: true,
      imports: [...(options.imports ?? []), ConnectorsModule],
      providers: [...this.createAsyncProviders(options), ...PROVIDERS],
      exports: PROVIDERS,
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
