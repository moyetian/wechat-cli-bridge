import { WorkflowRouteDecision } from '../types';
import { HeuristicRouterAdapter, RouterAdapter } from './router-adapter';

export class RoutingGateway {
  private adapter: RouterAdapter;

  constructor(adapter: RouterAdapter = new HeuristicRouterAdapter()) {
    this.adapter = adapter;
  }

  async routeTask(input: string): Promise<WorkflowRouteDecision> {
    return this.adapter.route(input);
  }
}

export default RoutingGateway;
