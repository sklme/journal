import 'reflect-metadata';

// #region rules
type ParamRule = { index: number; key: string };

const metadataStore = new WeakMap<
  object,
  Map<string | symbol, ParamRule[]>
>();

function Param(key: string): ParameterDecorator {
  return (target, method, index) => {
    if (method === undefined) {
      throw new Error('本示例只支持方法参数');
    }

    const methods = metadataStore.get(target) ?? new Map();
    const rules = methods.get(method) ?? [];
    methods.set(method, [...rules, { index, key }]);
    metadataStore.set(target, methods);
  };
}
// #endregion rules

// #region invoke
type RequestData = { params: Record<string, string> };

function invoke(instance: object, method: string, req: RequestData): unknown {
  const target = Object.getPrototypeOf(instance);
  const rules = metadataStore.get(target)?.get(method) ?? [];
  const args: unknown[] = [];

  for (const rule of rules) {
    args[rule.index] = req.params[rule.key];
  }

  const handler = (instance as Record<
    string,
    (...values: unknown[]) => unknown
  >)[method];
  return handler.apply(instance, args);
}
// #endregion invoke

// #region managed
function Managed(): ClassDecorator {
  return () => {};
}
// #endregion managed

// #region objects
@Managed()
class Database {
  findUser(id: string) {
    return { id, name: '示例用户' };
  }
}

@Managed()
class UserService {
  constructor(private readonly database: Database) {}

  findUser(id: string) {
    return this.database.findUser(id);
  }
}

@Managed()
class UserController {
  constructor(private readonly userService: UserService) {}

  getUser(@Param('id') id: string) {
    return this.userService.findUser(id);
  }
}
// #endregion objects

// #region container
type Constructor<T = object> = new (...args: any[]) => T;

class Container {
  private readonly instances = new Map<Constructor, object>();

  resolve<T extends object>(Type: Constructor<T>): T {
    const cached = this.instances.get(Type);
    if (cached) return cached as T;

    const dependencies: Constructor[] =
      Reflect.getMetadata('design:paramtypes', Type) ?? [];
    const args = dependencies.map(dependency => this.resolve(dependency));
    const instance = new Type(...args);
    this.instances.set(Type, instance);
    return instance;
  }
}
// #endregion container

// #region run
const container = new Container();
const controller = container.resolve(UserController);

console.log(
  Reflect.getMetadata('design:paramtypes', UserController)
    .map((Type: Constructor) => Type.name),
);
console.log(invoke(controller, 'getUser', { params: { id: '42' } }));
console.log(container.resolve(UserController) === controller);
// #endregion run

export { Container, Database, Managed, Param, UserController, UserService, invoke };
