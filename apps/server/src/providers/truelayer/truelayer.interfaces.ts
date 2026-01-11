import type {
  InjectionToken,
  ModuleMetadata,
  OptionalFactoryDependency,
  Type,
} from "@nestjs/common";
import type { TrueLayerConfig } from "@spark/truelayer/server";

export type TruelayerModuleOptions = TrueLayerConfig;

export interface TruelayerOptionsFactory {
  createTruelayerOptions(): Promise<TruelayerModuleOptions> | TruelayerModuleOptions;
}

export interface TruelayerModuleAsyncOptions extends Pick<ModuleMetadata, "imports"> {
  useExisting?: Type<TruelayerOptionsFactory>;
  useClass?: Type<TruelayerOptionsFactory>;
  useFactory?: (...args: unknown[]) => Promise<TruelayerModuleOptions> | TruelayerModuleOptions;
  inject?: (InjectionToken | OptionalFactoryDependency)[];
}
