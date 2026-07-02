/**
 * Injection token for the array of registered `FinancialConnector`s.
 * NestJS has no Angular-style multi-providers, so each connector is
 * registered as its own provider (letting it receive injected deps) and
 * aggregated under this token for the registry to consume.
 */
export const CONNECTORS = Symbol("connectors:connectors");
