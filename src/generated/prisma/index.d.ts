
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model User
 * 
 */
export type User = $Result.DefaultSelection<Prisma.$UserPayload>
/**
 * Model Conversation
 * 
 */
export type Conversation = $Result.DefaultSelection<Prisma.$ConversationPayload>
/**
 * Model Message
 * 
 */
export type Message = $Result.DefaultSelection<Prisma.$MessagePayload>
/**
 * Model LongTermMemory
 * 
 */
export type LongTermMemory = $Result.DefaultSelection<Prisma.$LongTermMemoryPayload>
/**
 * Model ResearchJobRecord
 * 
 */
export type ResearchJobRecord = $Result.DefaultSelection<Prisma.$ResearchJobRecordPayload>
/**
 * Model DocumentRecord
 * 
 */
export type DocumentRecord = $Result.DefaultSelection<Prisma.$DocumentRecordPayload>
/**
 * Model UserPreference
 * 
 */
export type UserPreference = $Result.DefaultSelection<Prisma.$UserPreferencePayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Users
   * const users = await prisma.user.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.user`: Exposes CRUD operations for the **User** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Users
    * const users = await prisma.user.findMany()
    * ```
    */
  get user(): Prisma.UserDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.conversation`: Exposes CRUD operations for the **Conversation** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Conversations
    * const conversations = await prisma.conversation.findMany()
    * ```
    */
  get conversation(): Prisma.ConversationDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.message`: Exposes CRUD operations for the **Message** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Messages
    * const messages = await prisma.message.findMany()
    * ```
    */
  get message(): Prisma.MessageDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.longTermMemory`: Exposes CRUD operations for the **LongTermMemory** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more LongTermMemories
    * const longTermMemories = await prisma.longTermMemory.findMany()
    * ```
    */
  get longTermMemory(): Prisma.LongTermMemoryDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.researchJobRecord`: Exposes CRUD operations for the **ResearchJobRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more ResearchJobRecords
    * const researchJobRecords = await prisma.researchJobRecord.findMany()
    * ```
    */
  get researchJobRecord(): Prisma.ResearchJobRecordDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.documentRecord`: Exposes CRUD operations for the **DocumentRecord** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more DocumentRecords
    * const documentRecords = await prisma.documentRecord.findMany()
    * ```
    */
  get documentRecord(): Prisma.DocumentRecordDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.userPreference`: Exposes CRUD operations for the **UserPreference** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more UserPreferences
    * const userPreferences = await prisma.userPreference.findMany()
    * ```
    */
  get userPreference(): Prisma.UserPreferenceDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.8.0
   * Query Engine version: 3c6e192761c0362d496ed980de936e2f3cebcd3a
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    User: 'User',
    Conversation: 'Conversation',
    Message: 'Message',
    LongTermMemory: 'LongTermMemory',
    ResearchJobRecord: 'ResearchJobRecord',
    DocumentRecord: 'DocumentRecord',
    UserPreference: 'UserPreference'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "user" | "conversation" | "message" | "longTermMemory" | "researchJobRecord" | "documentRecord" | "userPreference"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      User: {
        payload: Prisma.$UserPayload<ExtArgs>
        fields: Prisma.UserFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findFirst: {
            args: Prisma.UserFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          findMany: {
            args: Prisma.UserFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          create: {
            args: Prisma.UserCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          createMany: {
            args: Prisma.UserCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          delete: {
            args: Prisma.UserDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          update: {
            args: Prisma.UserUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          deleteMany: {
            args: Prisma.UserDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>[]
          }
          upsert: {
            args: Prisma.UserUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPayload>
          }
          aggregate: {
            args: Prisma.UserAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUser>
          }
          groupBy: {
            args: Prisma.UserGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserCountArgs<ExtArgs>
            result: $Utils.Optional<UserCountAggregateOutputType> | number
          }
        }
      }
      Conversation: {
        payload: Prisma.$ConversationPayload<ExtArgs>
        fields: Prisma.ConversationFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ConversationFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ConversationFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          findFirst: {
            args: Prisma.ConversationFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ConversationFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          findMany: {
            args: Prisma.ConversationFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>[]
          }
          create: {
            args: Prisma.ConversationCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          createMany: {
            args: Prisma.ConversationCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ConversationCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>[]
          }
          delete: {
            args: Prisma.ConversationDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          update: {
            args: Prisma.ConversationUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          deleteMany: {
            args: Prisma.ConversationDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ConversationUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ConversationUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>[]
          }
          upsert: {
            args: Prisma.ConversationUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ConversationPayload>
          }
          aggregate: {
            args: Prisma.ConversationAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateConversation>
          }
          groupBy: {
            args: Prisma.ConversationGroupByArgs<ExtArgs>
            result: $Utils.Optional<ConversationGroupByOutputType>[]
          }
          count: {
            args: Prisma.ConversationCountArgs<ExtArgs>
            result: $Utils.Optional<ConversationCountAggregateOutputType> | number
          }
        }
      }
      Message: {
        payload: Prisma.$MessagePayload<ExtArgs>
        fields: Prisma.MessageFieldRefs
        operations: {
          findUnique: {
            args: Prisma.MessageFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.MessageFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findFirst: {
            args: Prisma.MessageFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.MessageFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          findMany: {
            args: Prisma.MessageFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          create: {
            args: Prisma.MessageCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          createMany: {
            args: Prisma.MessageCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.MessageCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          delete: {
            args: Prisma.MessageDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          update: {
            args: Prisma.MessageUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          deleteMany: {
            args: Prisma.MessageDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.MessageUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.MessageUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>[]
          }
          upsert: {
            args: Prisma.MessageUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$MessagePayload>
          }
          aggregate: {
            args: Prisma.MessageAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateMessage>
          }
          groupBy: {
            args: Prisma.MessageGroupByArgs<ExtArgs>
            result: $Utils.Optional<MessageGroupByOutputType>[]
          }
          count: {
            args: Prisma.MessageCountArgs<ExtArgs>
            result: $Utils.Optional<MessageCountAggregateOutputType> | number
          }
        }
      }
      LongTermMemory: {
        payload: Prisma.$LongTermMemoryPayload<ExtArgs>
        fields: Prisma.LongTermMemoryFieldRefs
        operations: {
          findUnique: {
            args: Prisma.LongTermMemoryFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.LongTermMemoryFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          findFirst: {
            args: Prisma.LongTermMemoryFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.LongTermMemoryFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          findMany: {
            args: Prisma.LongTermMemoryFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>[]
          }
          create: {
            args: Prisma.LongTermMemoryCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          createMany: {
            args: Prisma.LongTermMemoryCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.LongTermMemoryCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>[]
          }
          delete: {
            args: Prisma.LongTermMemoryDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          update: {
            args: Prisma.LongTermMemoryUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          deleteMany: {
            args: Prisma.LongTermMemoryDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.LongTermMemoryUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.LongTermMemoryUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>[]
          }
          upsert: {
            args: Prisma.LongTermMemoryUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$LongTermMemoryPayload>
          }
          aggregate: {
            args: Prisma.LongTermMemoryAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateLongTermMemory>
          }
          groupBy: {
            args: Prisma.LongTermMemoryGroupByArgs<ExtArgs>
            result: $Utils.Optional<LongTermMemoryGroupByOutputType>[]
          }
          count: {
            args: Prisma.LongTermMemoryCountArgs<ExtArgs>
            result: $Utils.Optional<LongTermMemoryCountAggregateOutputType> | number
          }
        }
      }
      ResearchJobRecord: {
        payload: Prisma.$ResearchJobRecordPayload<ExtArgs>
        fields: Prisma.ResearchJobRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.ResearchJobRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.ResearchJobRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          findFirst: {
            args: Prisma.ResearchJobRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.ResearchJobRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          findMany: {
            args: Prisma.ResearchJobRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>[]
          }
          create: {
            args: Prisma.ResearchJobRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          createMany: {
            args: Prisma.ResearchJobRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.ResearchJobRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>[]
          }
          delete: {
            args: Prisma.ResearchJobRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          update: {
            args: Prisma.ResearchJobRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          deleteMany: {
            args: Prisma.ResearchJobRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.ResearchJobRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.ResearchJobRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>[]
          }
          upsert: {
            args: Prisma.ResearchJobRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$ResearchJobRecordPayload>
          }
          aggregate: {
            args: Prisma.ResearchJobRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateResearchJobRecord>
          }
          groupBy: {
            args: Prisma.ResearchJobRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<ResearchJobRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.ResearchJobRecordCountArgs<ExtArgs>
            result: $Utils.Optional<ResearchJobRecordCountAggregateOutputType> | number
          }
        }
      }
      DocumentRecord: {
        payload: Prisma.$DocumentRecordPayload<ExtArgs>
        fields: Prisma.DocumentRecordFieldRefs
        operations: {
          findUnique: {
            args: Prisma.DocumentRecordFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.DocumentRecordFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          findFirst: {
            args: Prisma.DocumentRecordFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.DocumentRecordFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          findMany: {
            args: Prisma.DocumentRecordFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>[]
          }
          create: {
            args: Prisma.DocumentRecordCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          createMany: {
            args: Prisma.DocumentRecordCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.DocumentRecordCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>[]
          }
          delete: {
            args: Prisma.DocumentRecordDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          update: {
            args: Prisma.DocumentRecordUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          deleteMany: {
            args: Prisma.DocumentRecordDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.DocumentRecordUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.DocumentRecordUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>[]
          }
          upsert: {
            args: Prisma.DocumentRecordUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$DocumentRecordPayload>
          }
          aggregate: {
            args: Prisma.DocumentRecordAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateDocumentRecord>
          }
          groupBy: {
            args: Prisma.DocumentRecordGroupByArgs<ExtArgs>
            result: $Utils.Optional<DocumentRecordGroupByOutputType>[]
          }
          count: {
            args: Prisma.DocumentRecordCountArgs<ExtArgs>
            result: $Utils.Optional<DocumentRecordCountAggregateOutputType> | number
          }
        }
      }
      UserPreference: {
        payload: Prisma.$UserPreferencePayload<ExtArgs>
        fields: Prisma.UserPreferenceFieldRefs
        operations: {
          findUnique: {
            args: Prisma.UserPreferenceFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.UserPreferenceFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          findFirst: {
            args: Prisma.UserPreferenceFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.UserPreferenceFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          findMany: {
            args: Prisma.UserPreferenceFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>[]
          }
          create: {
            args: Prisma.UserPreferenceCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          createMany: {
            args: Prisma.UserPreferenceCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.UserPreferenceCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>[]
          }
          delete: {
            args: Prisma.UserPreferenceDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          update: {
            args: Prisma.UserPreferenceUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          deleteMany: {
            args: Prisma.UserPreferenceDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.UserPreferenceUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.UserPreferenceUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>[]
          }
          upsert: {
            args: Prisma.UserPreferenceUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$UserPreferencePayload>
          }
          aggregate: {
            args: Prisma.UserPreferenceAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateUserPreference>
          }
          groupBy: {
            args: Prisma.UserPreferenceGroupByArgs<ExtArgs>
            result: $Utils.Optional<UserPreferenceGroupByOutputType>[]
          }
          count: {
            args: Prisma.UserPreferenceCountArgs<ExtArgs>
            result: $Utils.Optional<UserPreferenceCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    user?: UserOmit
    conversation?: ConversationOmit
    message?: MessageOmit
    longTermMemory?: LongTermMemoryOmit
    researchJobRecord?: ResearchJobRecordOmit
    documentRecord?: DocumentRecordOmit
    userPreference?: UserPreferenceOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */


  /**
   * Count Type UserCountOutputType
   */

  export type UserCountOutputType = {
    conversations: number
    researchJobs: number
    documents: number
    memories: number
  }

  export type UserCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    conversations?: boolean | UserCountOutputTypeCountConversationsArgs
    researchJobs?: boolean | UserCountOutputTypeCountResearchJobsArgs
    documents?: boolean | UserCountOutputTypeCountDocumentsArgs
    memories?: boolean | UserCountOutputTypeCountMemoriesArgs
  }

  // Custom InputTypes
  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserCountOutputType
     */
    select?: UserCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountConversationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConversationWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountResearchJobsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ResearchJobRecordWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountDocumentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DocumentRecordWhereInput
  }

  /**
   * UserCountOutputType without action
   */
  export type UserCountOutputTypeCountMemoriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LongTermMemoryWhereInput
  }


  /**
   * Count Type ConversationCountOutputType
   */

  export type ConversationCountOutputType = {
    messages: number
  }

  export type ConversationCountOutputTypeSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    messages?: boolean | ConversationCountOutputTypeCountMessagesArgs
  }

  // Custom InputTypes
  /**
   * ConversationCountOutputType without action
   */
  export type ConversationCountOutputTypeDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ConversationCountOutputType
     */
    select?: ConversationCountOutputTypeSelect<ExtArgs> | null
  }

  /**
   * ConversationCountOutputType without action
   */
  export type ConversationCountOutputTypeCountMessagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
  }


  /**
   * Models
   */

  /**
   * Model User
   */

  export type AggregateUser = {
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  export type UserMinAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    passwordHash: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserMaxAggregateOutputType = {
    id: string | null
    email: string | null
    name: string | null
    passwordHash: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type UserCountAggregateOutputType = {
    id: number
    email: number
    name: number
    passwordHash: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type UserMinAggregateInputType = {
    id?: true
    email?: true
    name?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserMaxAggregateInputType = {
    id?: true
    email?: true
    name?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
  }

  export type UserCountAggregateInputType = {
    id?: true
    email?: true
    name?: true
    passwordHash?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type UserAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which User to aggregate.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Users
    **/
    _count?: true | UserCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserMaxAggregateInputType
  }

  export type GetUserAggregateType<T extends UserAggregateArgs> = {
        [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUser[P]>
      : GetScalarType<T[P], AggregateUser[P]>
  }




  export type UserGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserWhereInput
    orderBy?: UserOrderByWithAggregationInput | UserOrderByWithAggregationInput[]
    by: UserScalarFieldEnum[] | UserScalarFieldEnum
    having?: UserScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserCountAggregateInputType | true
    _min?: UserMinAggregateInputType
    _max?: UserMaxAggregateInputType
  }

  export type UserGroupByOutputType = {
    id: string
    email: string | null
    name: string | null
    passwordHash: string | null
    createdAt: Date
    updatedAt: Date
    _count: UserCountAggregateOutputType | null
    _min: UserMinAggregateOutputType | null
    _max: UserMaxAggregateOutputType | null
  }

  type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserGroupByOutputType[P]>
            : GetScalarType<T[P], UserGroupByOutputType[P]>
        }
      >
    >


  export type UserSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    conversations?: boolean | User$conversationsArgs<ExtArgs>
    researchJobs?: boolean | User$researchJobsArgs<ExtArgs>
    documents?: boolean | User$documentsArgs<ExtArgs>
    preferences?: boolean | User$preferencesArgs<ExtArgs>
    memories?: boolean | User$memoriesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["user"]>

  export type UserSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    email?: boolean
    name?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["user"]>

  export type UserSelectScalar = {
    id?: boolean
    email?: boolean
    name?: boolean
    passwordHash?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type UserOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "email" | "name" | "passwordHash" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>
  export type UserInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    conversations?: boolean | User$conversationsArgs<ExtArgs>
    researchJobs?: boolean | User$researchJobsArgs<ExtArgs>
    documents?: boolean | User$documentsArgs<ExtArgs>
    preferences?: boolean | User$preferencesArgs<ExtArgs>
    memories?: boolean | User$memoriesArgs<ExtArgs>
    _count?: boolean | UserCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type UserIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}
  export type UserIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {}

  export type $UserPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "User"
    objects: {
      conversations: Prisma.$ConversationPayload<ExtArgs>[]
      researchJobs: Prisma.$ResearchJobRecordPayload<ExtArgs>[]
      documents: Prisma.$DocumentRecordPayload<ExtArgs>[]
      preferences: Prisma.$UserPreferencePayload<ExtArgs> | null
      memories: Prisma.$LongTermMemoryPayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      email: string | null
      name: string | null
      passwordHash: string | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["user"]>
    composites: {}
  }

  type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = $Result.GetResult<Prisma.$UserPayload, S>

  type UserCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserCountAggregateInputType | true
    }

  export interface UserDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['User'], meta: { name: 'User' } }
    /**
     * Find zero or one User that matches the filter.
     * @param {UserFindUniqueArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserFindUniqueArgs>(args: SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one User that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserFindUniqueOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserFindFirstArgs>(args?: SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first User that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindFirstOrThrowArgs} args - Arguments to find a User
     * @example
     * // Get one User
     * const user = await prisma.user.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Users that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Users
     * const users = await prisma.user.findMany()
     * 
     * // Get first 10 Users
     * const users = await prisma.user.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const userWithIdOnly = await prisma.user.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends UserFindManyArgs>(args?: SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a User.
     * @param {UserCreateArgs} args - Arguments to create a User.
     * @example
     * // Create one User
     * const User = await prisma.user.create({
     *   data: {
     *     // ... data to create a User
     *   }
     * })
     * 
     */
    create<T extends UserCreateArgs>(args: SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Users.
     * @param {UserCreateManyArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserCreateManyArgs>(args?: SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Users and returns the data saved in the database.
     * @param {UserCreateManyAndReturnArgs} args - Arguments to create many Users.
     * @example
     * // Create many Users
     * const user = await prisma.user.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Users and only return the `id`
     * const userWithIdOnly = await prisma.user.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserCreateManyAndReturnArgs>(args?: SelectSubset<T, UserCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a User.
     * @param {UserDeleteArgs} args - Arguments to delete one User.
     * @example
     * // Delete one User
     * const User = await prisma.user.delete({
     *   where: {
     *     // ... filter to delete one User
     *   }
     * })
     * 
     */
    delete<T extends UserDeleteArgs>(args: SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one User.
     * @param {UserUpdateArgs} args - Arguments to update one User.
     * @example
     * // Update one User
     * const user = await prisma.user.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserUpdateArgs>(args: SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Users.
     * @param {UserDeleteManyArgs} args - Arguments to filter Users to delete.
     * @example
     * // Delete a few Users
     * const { count } = await prisma.user.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserDeleteManyArgs>(args?: SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserUpdateManyArgs>(args: SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Users and returns the data updated in the database.
     * @param {UserUpdateManyAndReturnArgs} args - Arguments to update many Users.
     * @example
     * // Update many Users
     * const user = await prisma.user.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Users and only return the `id`
     * const userWithIdOnly = await prisma.user.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserUpdateManyAndReturnArgs>(args: SelectSubset<T, UserUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one User.
     * @param {UserUpsertArgs} args - Arguments to update or create a User.
     * @example
     * // Update or create a User
     * const user = await prisma.user.upsert({
     *   create: {
     *     // ... data to create a User
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the User we want to update
     *   }
     * })
     */
    upsert<T extends UserUpsertArgs>(args: SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Users.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserCountArgs} args - Arguments to filter Users to count.
     * @example
     * // Count the number of Users
     * const count = await prisma.user.count({
     *   where: {
     *     // ... the filter for the Users we want to count
     *   }
     * })
    **/
    count<T extends UserCountArgs>(
      args?: Subset<T, UserCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserAggregateArgs>(args: Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>

    /**
     * Group by User.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserGroupByArgs['orderBy'] }
        : { orderBy?: UserGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the User model
   */
  readonly fields: UserFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for User.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    conversations<T extends User$conversationsArgs<ExtArgs> = {}>(args?: Subset<T, User$conversationsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    researchJobs<T extends User$researchJobsArgs<ExtArgs> = {}>(args?: Subset<T, User$researchJobsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    documents<T extends User$documentsArgs<ExtArgs> = {}>(args?: Subset<T, User$documentsArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    preferences<T extends User$preferencesArgs<ExtArgs> = {}>(args?: Subset<T, User$preferencesArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>
    memories<T extends User$memoriesArgs<ExtArgs> = {}>(args?: Subset<T, User$memoriesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the User model
   */
  interface UserFieldRefs {
    readonly id: FieldRef<"User", 'String'>
    readonly email: FieldRef<"User", 'String'>
    readonly name: FieldRef<"User", 'String'>
    readonly passwordHash: FieldRef<"User", 'String'>
    readonly createdAt: FieldRef<"User", 'DateTime'>
    readonly updatedAt: FieldRef<"User", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * User findUnique
   */
  export type UserFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findUniqueOrThrow
   */
  export type UserFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User findFirst
   */
  export type UserFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findFirstOrThrow
   */
  export type UserFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which User to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User findMany
   */
  export type UserFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter, which Users to fetch.
     */
    where?: UserWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Users to fetch.
     */
    orderBy?: UserOrderByWithRelationInput | UserOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Users.
     */
    cursor?: UserWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Users from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Users.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Users.
     */
    distinct?: UserScalarFieldEnum | UserScalarFieldEnum[]
  }

  /**
   * User create
   */
  export type UserCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to create a User.
     */
    data: XOR<UserCreateInput, UserUncheckedCreateInput>
  }

  /**
   * User createMany
   */
  export type UserCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User createManyAndReturn
   */
  export type UserCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to create many Users.
     */
    data: UserCreateManyInput | UserCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * User update
   */
  export type UserUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The data needed to update a User.
     */
    data: XOR<UserUpdateInput, UserUncheckedUpdateInput>
    /**
     * Choose, which User to update.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User updateMany
   */
  export type UserUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User updateManyAndReturn
   */
  export type UserUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * The data used to update Users.
     */
    data: XOR<UserUpdateManyMutationInput, UserUncheckedUpdateManyInput>
    /**
     * Filter which Users to update
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to update.
     */
    limit?: number
  }

  /**
   * User upsert
   */
  export type UserUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * The filter to search for the User to update in case it exists.
     */
    where: UserWhereUniqueInput
    /**
     * In case the User found by the `where` argument doesn't exist, create a new User with this data.
     */
    create: XOR<UserCreateInput, UserUncheckedCreateInput>
    /**
     * In case the User was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserUpdateInput, UserUncheckedUpdateInput>
  }

  /**
   * User delete
   */
  export type UserDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
    /**
     * Filter which User to delete.
     */
    where: UserWhereUniqueInput
  }

  /**
   * User deleteMany
   */
  export type UserDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Users to delete
     */
    where?: UserWhereInput
    /**
     * Limit how many Users to delete.
     */
    limit?: number
  }

  /**
   * User.conversations
   */
  export type User$conversationsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    where?: ConversationWhereInput
    orderBy?: ConversationOrderByWithRelationInput | ConversationOrderByWithRelationInput[]
    cursor?: ConversationWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ConversationScalarFieldEnum | ConversationScalarFieldEnum[]
  }

  /**
   * User.researchJobs
   */
  export type User$researchJobsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    where?: ResearchJobRecordWhereInput
    orderBy?: ResearchJobRecordOrderByWithRelationInput | ResearchJobRecordOrderByWithRelationInput[]
    cursor?: ResearchJobRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: ResearchJobRecordScalarFieldEnum | ResearchJobRecordScalarFieldEnum[]
  }

  /**
   * User.documents
   */
  export type User$documentsArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    where?: DocumentRecordWhereInput
    orderBy?: DocumentRecordOrderByWithRelationInput | DocumentRecordOrderByWithRelationInput[]
    cursor?: DocumentRecordWhereUniqueInput
    take?: number
    skip?: number
    distinct?: DocumentRecordScalarFieldEnum | DocumentRecordScalarFieldEnum[]
  }

  /**
   * User.preferences
   */
  export type User$preferencesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    where?: UserPreferenceWhereInput
  }

  /**
   * User.memories
   */
  export type User$memoriesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    where?: LongTermMemoryWhereInput
    orderBy?: LongTermMemoryOrderByWithRelationInput | LongTermMemoryOrderByWithRelationInput[]
    cursor?: LongTermMemoryWhereUniqueInput
    take?: number
    skip?: number
    distinct?: LongTermMemoryScalarFieldEnum | LongTermMemoryScalarFieldEnum[]
  }

  /**
   * User without action
   */
  export type UserDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the User
     */
    select?: UserSelect<ExtArgs> | null
    /**
     * Omit specific fields from the User
     */
    omit?: UserOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserInclude<ExtArgs> | null
  }


  /**
   * Model Conversation
   */

  export type AggregateConversation = {
    _count: ConversationCountAggregateOutputType | null
    _min: ConversationMinAggregateOutputType | null
    _max: ConversationMaxAggregateOutputType | null
  }

  export type ConversationMinAggregateOutputType = {
    id: string | null
    userId: string | null
    title: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ConversationMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    title: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ConversationCountAggregateOutputType = {
    id: number
    userId: number
    title: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ConversationMinAggregateInputType = {
    id?: true
    userId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ConversationMaxAggregateInputType = {
    id?: true
    userId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ConversationCountAggregateInputType = {
    id?: true
    userId?: true
    title?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ConversationAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Conversation to aggregate.
     */
    where?: ConversationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Conversations to fetch.
     */
    orderBy?: ConversationOrderByWithRelationInput | ConversationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ConversationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Conversations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Conversations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Conversations
    **/
    _count?: true | ConversationCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ConversationMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ConversationMaxAggregateInputType
  }

  export type GetConversationAggregateType<T extends ConversationAggregateArgs> = {
        [P in keyof T & keyof AggregateConversation]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateConversation[P]>
      : GetScalarType<T[P], AggregateConversation[P]>
  }




  export type ConversationGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ConversationWhereInput
    orderBy?: ConversationOrderByWithAggregationInput | ConversationOrderByWithAggregationInput[]
    by: ConversationScalarFieldEnum[] | ConversationScalarFieldEnum
    having?: ConversationScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ConversationCountAggregateInputType | true
    _min?: ConversationMinAggregateInputType
    _max?: ConversationMaxAggregateInputType
  }

  export type ConversationGroupByOutputType = {
    id: string
    userId: string
    title: string
    createdAt: Date
    updatedAt: Date
    _count: ConversationCountAggregateOutputType | null
    _min: ConversationMinAggregateOutputType | null
    _max: ConversationMaxAggregateOutputType | null
  }

  type GetConversationGroupByPayload<T extends ConversationGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ConversationGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ConversationGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ConversationGroupByOutputType[P]>
            : GetScalarType<T[P], ConversationGroupByOutputType[P]>
        }
      >
    >


  export type ConversationSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
    messages?: boolean | Conversation$messagesArgs<ExtArgs>
    _count?: boolean | ConversationCountOutputTypeDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversation"]>

  export type ConversationSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversation"]>

  export type ConversationSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["conversation"]>

  export type ConversationSelectScalar = {
    id?: boolean
    userId?: boolean
    title?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ConversationOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "title" | "createdAt" | "updatedAt", ExtArgs["result"]["conversation"]>
  export type ConversationInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
    messages?: boolean | Conversation$messagesArgs<ExtArgs>
    _count?: boolean | ConversationCountOutputTypeDefaultArgs<ExtArgs>
  }
  export type ConversationIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ConversationIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ConversationPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Conversation"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
      messages: Prisma.$MessagePayload<ExtArgs>[]
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      title: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["conversation"]>
    composites: {}
  }

  type ConversationGetPayload<S extends boolean | null | undefined | ConversationDefaultArgs> = $Result.GetResult<Prisma.$ConversationPayload, S>

  type ConversationCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ConversationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ConversationCountAggregateInputType | true
    }

  export interface ConversationDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Conversation'], meta: { name: 'Conversation' } }
    /**
     * Find zero or one Conversation that matches the filter.
     * @param {ConversationFindUniqueArgs} args - Arguments to find a Conversation
     * @example
     * // Get one Conversation
     * const conversation = await prisma.conversation.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ConversationFindUniqueArgs>(args: SelectSubset<T, ConversationFindUniqueArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Conversation that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ConversationFindUniqueOrThrowArgs} args - Arguments to find a Conversation
     * @example
     * // Get one Conversation
     * const conversation = await prisma.conversation.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ConversationFindUniqueOrThrowArgs>(args: SelectSubset<T, ConversationFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Conversation that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationFindFirstArgs} args - Arguments to find a Conversation
     * @example
     * // Get one Conversation
     * const conversation = await prisma.conversation.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ConversationFindFirstArgs>(args?: SelectSubset<T, ConversationFindFirstArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Conversation that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationFindFirstOrThrowArgs} args - Arguments to find a Conversation
     * @example
     * // Get one Conversation
     * const conversation = await prisma.conversation.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ConversationFindFirstOrThrowArgs>(args?: SelectSubset<T, ConversationFindFirstOrThrowArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Conversations that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Conversations
     * const conversations = await prisma.conversation.findMany()
     * 
     * // Get first 10 Conversations
     * const conversations = await prisma.conversation.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const conversationWithIdOnly = await prisma.conversation.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ConversationFindManyArgs>(args?: SelectSubset<T, ConversationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Conversation.
     * @param {ConversationCreateArgs} args - Arguments to create a Conversation.
     * @example
     * // Create one Conversation
     * const Conversation = await prisma.conversation.create({
     *   data: {
     *     // ... data to create a Conversation
     *   }
     * })
     * 
     */
    create<T extends ConversationCreateArgs>(args: SelectSubset<T, ConversationCreateArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Conversations.
     * @param {ConversationCreateManyArgs} args - Arguments to create many Conversations.
     * @example
     * // Create many Conversations
     * const conversation = await prisma.conversation.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ConversationCreateManyArgs>(args?: SelectSubset<T, ConversationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Conversations and returns the data saved in the database.
     * @param {ConversationCreateManyAndReturnArgs} args - Arguments to create many Conversations.
     * @example
     * // Create many Conversations
     * const conversation = await prisma.conversation.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Conversations and only return the `id`
     * const conversationWithIdOnly = await prisma.conversation.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ConversationCreateManyAndReturnArgs>(args?: SelectSubset<T, ConversationCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Conversation.
     * @param {ConversationDeleteArgs} args - Arguments to delete one Conversation.
     * @example
     * // Delete one Conversation
     * const Conversation = await prisma.conversation.delete({
     *   where: {
     *     // ... filter to delete one Conversation
     *   }
     * })
     * 
     */
    delete<T extends ConversationDeleteArgs>(args: SelectSubset<T, ConversationDeleteArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Conversation.
     * @param {ConversationUpdateArgs} args - Arguments to update one Conversation.
     * @example
     * // Update one Conversation
     * const conversation = await prisma.conversation.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ConversationUpdateArgs>(args: SelectSubset<T, ConversationUpdateArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Conversations.
     * @param {ConversationDeleteManyArgs} args - Arguments to filter Conversations to delete.
     * @example
     * // Delete a few Conversations
     * const { count } = await prisma.conversation.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ConversationDeleteManyArgs>(args?: SelectSubset<T, ConversationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Conversations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Conversations
     * const conversation = await prisma.conversation.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ConversationUpdateManyArgs>(args: SelectSubset<T, ConversationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Conversations and returns the data updated in the database.
     * @param {ConversationUpdateManyAndReturnArgs} args - Arguments to update many Conversations.
     * @example
     * // Update many Conversations
     * const conversation = await prisma.conversation.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Conversations and only return the `id`
     * const conversationWithIdOnly = await prisma.conversation.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ConversationUpdateManyAndReturnArgs>(args: SelectSubset<T, ConversationUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Conversation.
     * @param {ConversationUpsertArgs} args - Arguments to update or create a Conversation.
     * @example
     * // Update or create a Conversation
     * const conversation = await prisma.conversation.upsert({
     *   create: {
     *     // ... data to create a Conversation
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Conversation we want to update
     *   }
     * })
     */
    upsert<T extends ConversationUpsertArgs>(args: SelectSubset<T, ConversationUpsertArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Conversations.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationCountArgs} args - Arguments to filter Conversations to count.
     * @example
     * // Count the number of Conversations
     * const count = await prisma.conversation.count({
     *   where: {
     *     // ... the filter for the Conversations we want to count
     *   }
     * })
    **/
    count<T extends ConversationCountArgs>(
      args?: Subset<T, ConversationCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ConversationCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Conversation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ConversationAggregateArgs>(args: Subset<T, ConversationAggregateArgs>): Prisma.PrismaPromise<GetConversationAggregateType<T>>

    /**
     * Group by Conversation.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ConversationGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ConversationGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ConversationGroupByArgs['orderBy'] }
        : { orderBy?: ConversationGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ConversationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetConversationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Conversation model
   */
  readonly fields: ConversationFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Conversation.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ConversationClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    messages<T extends Conversation$messagesArgs<ExtArgs> = {}>(args?: Subset<T, Conversation$messagesArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Conversation model
   */
  interface ConversationFieldRefs {
    readonly id: FieldRef<"Conversation", 'String'>
    readonly userId: FieldRef<"Conversation", 'String'>
    readonly title: FieldRef<"Conversation", 'String'>
    readonly createdAt: FieldRef<"Conversation", 'DateTime'>
    readonly updatedAt: FieldRef<"Conversation", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Conversation findUnique
   */
  export type ConversationFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter, which Conversation to fetch.
     */
    where: ConversationWhereUniqueInput
  }

  /**
   * Conversation findUniqueOrThrow
   */
  export type ConversationFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter, which Conversation to fetch.
     */
    where: ConversationWhereUniqueInput
  }

  /**
   * Conversation findFirst
   */
  export type ConversationFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter, which Conversation to fetch.
     */
    where?: ConversationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Conversations to fetch.
     */
    orderBy?: ConversationOrderByWithRelationInput | ConversationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Conversations.
     */
    cursor?: ConversationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Conversations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Conversations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Conversations.
     */
    distinct?: ConversationScalarFieldEnum | ConversationScalarFieldEnum[]
  }

  /**
   * Conversation findFirstOrThrow
   */
  export type ConversationFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter, which Conversation to fetch.
     */
    where?: ConversationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Conversations to fetch.
     */
    orderBy?: ConversationOrderByWithRelationInput | ConversationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Conversations.
     */
    cursor?: ConversationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Conversations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Conversations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Conversations.
     */
    distinct?: ConversationScalarFieldEnum | ConversationScalarFieldEnum[]
  }

  /**
   * Conversation findMany
   */
  export type ConversationFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter, which Conversations to fetch.
     */
    where?: ConversationWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Conversations to fetch.
     */
    orderBy?: ConversationOrderByWithRelationInput | ConversationOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Conversations.
     */
    cursor?: ConversationWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Conversations from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Conversations.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Conversations.
     */
    distinct?: ConversationScalarFieldEnum | ConversationScalarFieldEnum[]
  }

  /**
   * Conversation create
   */
  export type ConversationCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * The data needed to create a Conversation.
     */
    data: XOR<ConversationCreateInput, ConversationUncheckedCreateInput>
  }

  /**
   * Conversation createMany
   */
  export type ConversationCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Conversations.
     */
    data: ConversationCreateManyInput | ConversationCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Conversation createManyAndReturn
   */
  export type ConversationCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * The data used to create many Conversations.
     */
    data: ConversationCreateManyInput | ConversationCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Conversation update
   */
  export type ConversationUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * The data needed to update a Conversation.
     */
    data: XOR<ConversationUpdateInput, ConversationUncheckedUpdateInput>
    /**
     * Choose, which Conversation to update.
     */
    where: ConversationWhereUniqueInput
  }

  /**
   * Conversation updateMany
   */
  export type ConversationUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Conversations.
     */
    data: XOR<ConversationUpdateManyMutationInput, ConversationUncheckedUpdateManyInput>
    /**
     * Filter which Conversations to update
     */
    where?: ConversationWhereInput
    /**
     * Limit how many Conversations to update.
     */
    limit?: number
  }

  /**
   * Conversation updateManyAndReturn
   */
  export type ConversationUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * The data used to update Conversations.
     */
    data: XOR<ConversationUpdateManyMutationInput, ConversationUncheckedUpdateManyInput>
    /**
     * Filter which Conversations to update
     */
    where?: ConversationWhereInput
    /**
     * Limit how many Conversations to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Conversation upsert
   */
  export type ConversationUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * The filter to search for the Conversation to update in case it exists.
     */
    where: ConversationWhereUniqueInput
    /**
     * In case the Conversation found by the `where` argument doesn't exist, create a new Conversation with this data.
     */
    create: XOR<ConversationCreateInput, ConversationUncheckedCreateInput>
    /**
     * In case the Conversation was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ConversationUpdateInput, ConversationUncheckedUpdateInput>
  }

  /**
   * Conversation delete
   */
  export type ConversationDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
    /**
     * Filter which Conversation to delete.
     */
    where: ConversationWhereUniqueInput
  }

  /**
   * Conversation deleteMany
   */
  export type ConversationDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Conversations to delete
     */
    where?: ConversationWhereInput
    /**
     * Limit how many Conversations to delete.
     */
    limit?: number
  }

  /**
   * Conversation.messages
   */
  export type Conversation$messagesArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    cursor?: MessageWhereUniqueInput
    take?: number
    skip?: number
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Conversation without action
   */
  export type ConversationDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Conversation
     */
    select?: ConversationSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Conversation
     */
    omit?: ConversationOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ConversationInclude<ExtArgs> | null
  }


  /**
   * Model Message
   */

  export type AggregateMessage = {
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  export type MessageAvgAggregateOutputType = {
    tokensUsed: number | null
  }

  export type MessageSumAggregateOutputType = {
    tokensUsed: number | null
  }

  export type MessageMinAggregateOutputType = {
    id: string | null
    conversationId: string | null
    role: string | null
    content: string | null
    tokensUsed: number | null
    modelUsed: string | null
    createdAt: Date | null
  }

  export type MessageMaxAggregateOutputType = {
    id: string | null
    conversationId: string | null
    role: string | null
    content: string | null
    tokensUsed: number | null
    modelUsed: string | null
    createdAt: Date | null
  }

  export type MessageCountAggregateOutputType = {
    id: number
    conversationId: number
    role: number
    content: number
    tokensUsed: number
    modelUsed: number
    createdAt: number
    _all: number
  }


  export type MessageAvgAggregateInputType = {
    tokensUsed?: true
  }

  export type MessageSumAggregateInputType = {
    tokensUsed?: true
  }

  export type MessageMinAggregateInputType = {
    id?: true
    conversationId?: true
    role?: true
    content?: true
    tokensUsed?: true
    modelUsed?: true
    createdAt?: true
  }

  export type MessageMaxAggregateInputType = {
    id?: true
    conversationId?: true
    role?: true
    content?: true
    tokensUsed?: true
    modelUsed?: true
    createdAt?: true
  }

  export type MessageCountAggregateInputType = {
    id?: true
    conversationId?: true
    role?: true
    content?: true
    tokensUsed?: true
    modelUsed?: true
    createdAt?: true
    _all?: true
  }

  export type MessageAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Message to aggregate.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Messages
    **/
    _count?: true | MessageCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: MessageAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: MessageSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: MessageMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: MessageMaxAggregateInputType
  }

  export type GetMessageAggregateType<T extends MessageAggregateArgs> = {
        [P in keyof T & keyof AggregateMessage]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateMessage[P]>
      : GetScalarType<T[P], AggregateMessage[P]>
  }




  export type MessageGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: MessageWhereInput
    orderBy?: MessageOrderByWithAggregationInput | MessageOrderByWithAggregationInput[]
    by: MessageScalarFieldEnum[] | MessageScalarFieldEnum
    having?: MessageScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: MessageCountAggregateInputType | true
    _avg?: MessageAvgAggregateInputType
    _sum?: MessageSumAggregateInputType
    _min?: MessageMinAggregateInputType
    _max?: MessageMaxAggregateInputType
  }

  export type MessageGroupByOutputType = {
    id: string
    conversationId: string
    role: string
    content: string
    tokensUsed: number
    modelUsed: string | null
    createdAt: Date
    _count: MessageCountAggregateOutputType | null
    _avg: MessageAvgAggregateOutputType | null
    _sum: MessageSumAggregateOutputType | null
    _min: MessageMinAggregateOutputType | null
    _max: MessageMaxAggregateOutputType | null
  }

  type GetMessageGroupByPayload<T extends MessageGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<MessageGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof MessageGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], MessageGroupByOutputType[P]>
            : GetScalarType<T[P], MessageGroupByOutputType[P]>
        }
      >
    >


  export type MessageSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    conversationId?: boolean
    role?: boolean
    content?: boolean
    tokensUsed?: boolean
    modelUsed?: boolean
    createdAt?: boolean
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    conversationId?: boolean
    role?: boolean
    content?: boolean
    tokensUsed?: boolean
    modelUsed?: boolean
    createdAt?: boolean
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    conversationId?: boolean
    role?: boolean
    content?: boolean
    tokensUsed?: boolean
    modelUsed?: boolean
    createdAt?: boolean
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["message"]>

  export type MessageSelectScalar = {
    id?: boolean
    conversationId?: boolean
    role?: boolean
    content?: boolean
    tokensUsed?: boolean
    modelUsed?: boolean
    createdAt?: boolean
  }

  export type MessageOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "conversationId" | "role" | "content" | "tokensUsed" | "modelUsed" | "createdAt", ExtArgs["result"]["message"]>
  export type MessageInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }
  export type MessageIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }
  export type MessageIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    conversation?: boolean | ConversationDefaultArgs<ExtArgs>
  }

  export type $MessagePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Message"
    objects: {
      conversation: Prisma.$ConversationPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      conversationId: string
      role: string
      content: string
      tokensUsed: number
      modelUsed: string | null
      createdAt: Date
    }, ExtArgs["result"]["message"]>
    composites: {}
  }

  type MessageGetPayload<S extends boolean | null | undefined | MessageDefaultArgs> = $Result.GetResult<Prisma.$MessagePayload, S>

  type MessageCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<MessageFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: MessageCountAggregateInputType | true
    }

  export interface MessageDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Message'], meta: { name: 'Message' } }
    /**
     * Find zero or one Message that matches the filter.
     * @param {MessageFindUniqueArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends MessageFindUniqueArgs>(args: SelectSubset<T, MessageFindUniqueArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Message that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {MessageFindUniqueOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends MessageFindUniqueOrThrowArgs>(args: SelectSubset<T, MessageFindUniqueOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends MessageFindFirstArgs>(args?: SelectSubset<T, MessageFindFirstArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Message that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindFirstOrThrowArgs} args - Arguments to find a Message
     * @example
     * // Get one Message
     * const message = await prisma.message.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends MessageFindFirstOrThrowArgs>(args?: SelectSubset<T, MessageFindFirstOrThrowArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Messages that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Messages
     * const messages = await prisma.message.findMany()
     * 
     * // Get first 10 Messages
     * const messages = await prisma.message.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const messageWithIdOnly = await prisma.message.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends MessageFindManyArgs>(args?: SelectSubset<T, MessageFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Message.
     * @param {MessageCreateArgs} args - Arguments to create a Message.
     * @example
     * // Create one Message
     * const Message = await prisma.message.create({
     *   data: {
     *     // ... data to create a Message
     *   }
     * })
     * 
     */
    create<T extends MessageCreateArgs>(args: SelectSubset<T, MessageCreateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Messages.
     * @param {MessageCreateManyArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends MessageCreateManyArgs>(args?: SelectSubset<T, MessageCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Messages and returns the data saved in the database.
     * @param {MessageCreateManyAndReturnArgs} args - Arguments to create many Messages.
     * @example
     * // Create many Messages
     * const message = await prisma.message.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends MessageCreateManyAndReturnArgs>(args?: SelectSubset<T, MessageCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Message.
     * @param {MessageDeleteArgs} args - Arguments to delete one Message.
     * @example
     * // Delete one Message
     * const Message = await prisma.message.delete({
     *   where: {
     *     // ... filter to delete one Message
     *   }
     * })
     * 
     */
    delete<T extends MessageDeleteArgs>(args: SelectSubset<T, MessageDeleteArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Message.
     * @param {MessageUpdateArgs} args - Arguments to update one Message.
     * @example
     * // Update one Message
     * const message = await prisma.message.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends MessageUpdateArgs>(args: SelectSubset<T, MessageUpdateArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Messages.
     * @param {MessageDeleteManyArgs} args - Arguments to filter Messages to delete.
     * @example
     * // Delete a few Messages
     * const { count } = await prisma.message.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends MessageDeleteManyArgs>(args?: SelectSubset<T, MessageDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends MessageUpdateManyArgs>(args: SelectSubset<T, MessageUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Messages and returns the data updated in the database.
     * @param {MessageUpdateManyAndReturnArgs} args - Arguments to update many Messages.
     * @example
     * // Update many Messages
     * const message = await prisma.message.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Messages and only return the `id`
     * const messageWithIdOnly = await prisma.message.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends MessageUpdateManyAndReturnArgs>(args: SelectSubset<T, MessageUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Message.
     * @param {MessageUpsertArgs} args - Arguments to update or create a Message.
     * @example
     * // Update or create a Message
     * const message = await prisma.message.upsert({
     *   create: {
     *     // ... data to create a Message
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Message we want to update
     *   }
     * })
     */
    upsert<T extends MessageUpsertArgs>(args: SelectSubset<T, MessageUpsertArgs<ExtArgs>>): Prisma__MessageClient<$Result.GetResult<Prisma.$MessagePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Messages.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageCountArgs} args - Arguments to filter Messages to count.
     * @example
     * // Count the number of Messages
     * const count = await prisma.message.count({
     *   where: {
     *     // ... the filter for the Messages we want to count
     *   }
     * })
    **/
    count<T extends MessageCountArgs>(
      args?: Subset<T, MessageCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], MessageCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends MessageAggregateArgs>(args: Subset<T, MessageAggregateArgs>): Prisma.PrismaPromise<GetMessageAggregateType<T>>

    /**
     * Group by Message.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {MessageGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends MessageGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: MessageGroupByArgs['orderBy'] }
        : { orderBy?: MessageGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, MessageGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetMessageGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Message model
   */
  readonly fields: MessageFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Message.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__MessageClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    conversation<T extends ConversationDefaultArgs<ExtArgs> = {}>(args?: Subset<T, ConversationDefaultArgs<ExtArgs>>): Prisma__ConversationClient<$Result.GetResult<Prisma.$ConversationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Message model
   */
  interface MessageFieldRefs {
    readonly id: FieldRef<"Message", 'String'>
    readonly conversationId: FieldRef<"Message", 'String'>
    readonly role: FieldRef<"Message", 'String'>
    readonly content: FieldRef<"Message", 'String'>
    readonly tokensUsed: FieldRef<"Message", 'Int'>
    readonly modelUsed: FieldRef<"Message", 'String'>
    readonly createdAt: FieldRef<"Message", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Message findUnique
   */
  export type MessageFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findUniqueOrThrow
   */
  export type MessageFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message findFirst
   */
  export type MessageFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findFirstOrThrow
   */
  export type MessageFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Message to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message findMany
   */
  export type MessageFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter, which Messages to fetch.
     */
    where?: MessageWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Messages to fetch.
     */
    orderBy?: MessageOrderByWithRelationInput | MessageOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Messages.
     */
    cursor?: MessageWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Messages from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Messages.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Messages.
     */
    distinct?: MessageScalarFieldEnum | MessageScalarFieldEnum[]
  }

  /**
   * Message create
   */
  export type MessageCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to create a Message.
     */
    data: XOR<MessageCreateInput, MessageUncheckedCreateInput>
  }

  /**
   * Message createMany
   */
  export type MessageCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Message createManyAndReturn
   */
  export type MessageCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to create many Messages.
     */
    data: MessageCreateManyInput | MessageCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message update
   */
  export type MessageUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The data needed to update a Message.
     */
    data: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
    /**
     * Choose, which Message to update.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message updateMany
   */
  export type MessageUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
  }

  /**
   * Message updateManyAndReturn
   */
  export type MessageUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * The data used to update Messages.
     */
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyInput>
    /**
     * Filter which Messages to update
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * Message upsert
   */
  export type MessageUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * The filter to search for the Message to update in case it exists.
     */
    where: MessageWhereUniqueInput
    /**
     * In case the Message found by the `where` argument doesn't exist, create a new Message with this data.
     */
    create: XOR<MessageCreateInput, MessageUncheckedCreateInput>
    /**
     * In case the Message was found with the provided `where` argument, update it with this data.
     */
    update: XOR<MessageUpdateInput, MessageUncheckedUpdateInput>
  }

  /**
   * Message delete
   */
  export type MessageDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
    /**
     * Filter which Message to delete.
     */
    where: MessageWhereUniqueInput
  }

  /**
   * Message deleteMany
   */
  export type MessageDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Messages to delete
     */
    where?: MessageWhereInput
    /**
     * Limit how many Messages to delete.
     */
    limit?: number
  }

  /**
   * Message without action
   */
  export type MessageDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Message
     */
    select?: MessageSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Message
     */
    omit?: MessageOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: MessageInclude<ExtArgs> | null
  }


  /**
   * Model LongTermMemory
   */

  export type AggregateLongTermMemory = {
    _count: LongTermMemoryCountAggregateOutputType | null
    _avg: LongTermMemoryAvgAggregateOutputType | null
    _sum: LongTermMemorySumAggregateOutputType | null
    _min: LongTermMemoryMinAggregateOutputType | null
    _max: LongTermMemoryMaxAggregateOutputType | null
  }

  export type LongTermMemoryAvgAggregateOutputType = {
    confidence: number | null
    accessCount: number | null
  }

  export type LongTermMemorySumAggregateOutputType = {
    confidence: number | null
    accessCount: number | null
  }

  export type LongTermMemoryMinAggregateOutputType = {
    id: string | null
    userId: string | null
    type: string | null
    content: string | null
    confidence: number | null
    createdAt: Date | null
    lastAccessed: Date | null
    accessCount: number | null
  }

  export type LongTermMemoryMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    type: string | null
    content: string | null
    confidence: number | null
    createdAt: Date | null
    lastAccessed: Date | null
    accessCount: number | null
  }

  export type LongTermMemoryCountAggregateOutputType = {
    id: number
    userId: number
    type: number
    content: number
    confidence: number
    createdAt: number
    lastAccessed: number
    accessCount: number
    _all: number
  }


  export type LongTermMemoryAvgAggregateInputType = {
    confidence?: true
    accessCount?: true
  }

  export type LongTermMemorySumAggregateInputType = {
    confidence?: true
    accessCount?: true
  }

  export type LongTermMemoryMinAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    content?: true
    confidence?: true
    createdAt?: true
    lastAccessed?: true
    accessCount?: true
  }

  export type LongTermMemoryMaxAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    content?: true
    confidence?: true
    createdAt?: true
    lastAccessed?: true
    accessCount?: true
  }

  export type LongTermMemoryCountAggregateInputType = {
    id?: true
    userId?: true
    type?: true
    content?: true
    confidence?: true
    createdAt?: true
    lastAccessed?: true
    accessCount?: true
    _all?: true
  }

  export type LongTermMemoryAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LongTermMemory to aggregate.
     */
    where?: LongTermMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LongTermMemories to fetch.
     */
    orderBy?: LongTermMemoryOrderByWithRelationInput | LongTermMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: LongTermMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LongTermMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LongTermMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned LongTermMemories
    **/
    _count?: true | LongTermMemoryCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: LongTermMemoryAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: LongTermMemorySumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: LongTermMemoryMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: LongTermMemoryMaxAggregateInputType
  }

  export type GetLongTermMemoryAggregateType<T extends LongTermMemoryAggregateArgs> = {
        [P in keyof T & keyof AggregateLongTermMemory]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateLongTermMemory[P]>
      : GetScalarType<T[P], AggregateLongTermMemory[P]>
  }




  export type LongTermMemoryGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: LongTermMemoryWhereInput
    orderBy?: LongTermMemoryOrderByWithAggregationInput | LongTermMemoryOrderByWithAggregationInput[]
    by: LongTermMemoryScalarFieldEnum[] | LongTermMemoryScalarFieldEnum
    having?: LongTermMemoryScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: LongTermMemoryCountAggregateInputType | true
    _avg?: LongTermMemoryAvgAggregateInputType
    _sum?: LongTermMemorySumAggregateInputType
    _min?: LongTermMemoryMinAggregateInputType
    _max?: LongTermMemoryMaxAggregateInputType
  }

  export type LongTermMemoryGroupByOutputType = {
    id: string
    userId: string
    type: string
    content: string
    confidence: number
    createdAt: Date
    lastAccessed: Date | null
    accessCount: number
    _count: LongTermMemoryCountAggregateOutputType | null
    _avg: LongTermMemoryAvgAggregateOutputType | null
    _sum: LongTermMemorySumAggregateOutputType | null
    _min: LongTermMemoryMinAggregateOutputType | null
    _max: LongTermMemoryMaxAggregateOutputType | null
  }

  type GetLongTermMemoryGroupByPayload<T extends LongTermMemoryGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<LongTermMemoryGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof LongTermMemoryGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], LongTermMemoryGroupByOutputType[P]>
            : GetScalarType<T[P], LongTermMemoryGroupByOutputType[P]>
        }
      >
    >


  export type LongTermMemorySelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    content?: boolean
    confidence?: boolean
    createdAt?: boolean
    lastAccessed?: boolean
    accessCount?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["longTermMemory"]>

  export type LongTermMemorySelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    content?: boolean
    confidence?: boolean
    createdAt?: boolean
    lastAccessed?: boolean
    accessCount?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["longTermMemory"]>

  export type LongTermMemorySelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    type?: boolean
    content?: boolean
    confidence?: boolean
    createdAt?: boolean
    lastAccessed?: boolean
    accessCount?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["longTermMemory"]>

  export type LongTermMemorySelectScalar = {
    id?: boolean
    userId?: boolean
    type?: boolean
    content?: boolean
    confidence?: boolean
    createdAt?: boolean
    lastAccessed?: boolean
    accessCount?: boolean
  }

  export type LongTermMemoryOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "type" | "content" | "confidence" | "createdAt" | "lastAccessed" | "accessCount", ExtArgs["result"]["longTermMemory"]>
  export type LongTermMemoryInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type LongTermMemoryIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type LongTermMemoryIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $LongTermMemoryPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "LongTermMemory"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      type: string
      content: string
      confidence: number
      createdAt: Date
      lastAccessed: Date | null
      accessCount: number
    }, ExtArgs["result"]["longTermMemory"]>
    composites: {}
  }

  type LongTermMemoryGetPayload<S extends boolean | null | undefined | LongTermMemoryDefaultArgs> = $Result.GetResult<Prisma.$LongTermMemoryPayload, S>

  type LongTermMemoryCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<LongTermMemoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: LongTermMemoryCountAggregateInputType | true
    }

  export interface LongTermMemoryDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['LongTermMemory'], meta: { name: 'LongTermMemory' } }
    /**
     * Find zero or one LongTermMemory that matches the filter.
     * @param {LongTermMemoryFindUniqueArgs} args - Arguments to find a LongTermMemory
     * @example
     * // Get one LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends LongTermMemoryFindUniqueArgs>(args: SelectSubset<T, LongTermMemoryFindUniqueArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one LongTermMemory that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {LongTermMemoryFindUniqueOrThrowArgs} args - Arguments to find a LongTermMemory
     * @example
     * // Get one LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends LongTermMemoryFindUniqueOrThrowArgs>(args: SelectSubset<T, LongTermMemoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LongTermMemory that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryFindFirstArgs} args - Arguments to find a LongTermMemory
     * @example
     * // Get one LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends LongTermMemoryFindFirstArgs>(args?: SelectSubset<T, LongTermMemoryFindFirstArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first LongTermMemory that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryFindFirstOrThrowArgs} args - Arguments to find a LongTermMemory
     * @example
     * // Get one LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends LongTermMemoryFindFirstOrThrowArgs>(args?: SelectSubset<T, LongTermMemoryFindFirstOrThrowArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more LongTermMemories that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all LongTermMemories
     * const longTermMemories = await prisma.longTermMemory.findMany()
     * 
     * // Get first 10 LongTermMemories
     * const longTermMemories = await prisma.longTermMemory.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const longTermMemoryWithIdOnly = await prisma.longTermMemory.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends LongTermMemoryFindManyArgs>(args?: SelectSubset<T, LongTermMemoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a LongTermMemory.
     * @param {LongTermMemoryCreateArgs} args - Arguments to create a LongTermMemory.
     * @example
     * // Create one LongTermMemory
     * const LongTermMemory = await prisma.longTermMemory.create({
     *   data: {
     *     // ... data to create a LongTermMemory
     *   }
     * })
     * 
     */
    create<T extends LongTermMemoryCreateArgs>(args: SelectSubset<T, LongTermMemoryCreateArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many LongTermMemories.
     * @param {LongTermMemoryCreateManyArgs} args - Arguments to create many LongTermMemories.
     * @example
     * // Create many LongTermMemories
     * const longTermMemory = await prisma.longTermMemory.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends LongTermMemoryCreateManyArgs>(args?: SelectSubset<T, LongTermMemoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many LongTermMemories and returns the data saved in the database.
     * @param {LongTermMemoryCreateManyAndReturnArgs} args - Arguments to create many LongTermMemories.
     * @example
     * // Create many LongTermMemories
     * const longTermMemory = await prisma.longTermMemory.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many LongTermMemories and only return the `id`
     * const longTermMemoryWithIdOnly = await prisma.longTermMemory.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends LongTermMemoryCreateManyAndReturnArgs>(args?: SelectSubset<T, LongTermMemoryCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a LongTermMemory.
     * @param {LongTermMemoryDeleteArgs} args - Arguments to delete one LongTermMemory.
     * @example
     * // Delete one LongTermMemory
     * const LongTermMemory = await prisma.longTermMemory.delete({
     *   where: {
     *     // ... filter to delete one LongTermMemory
     *   }
     * })
     * 
     */
    delete<T extends LongTermMemoryDeleteArgs>(args: SelectSubset<T, LongTermMemoryDeleteArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one LongTermMemory.
     * @param {LongTermMemoryUpdateArgs} args - Arguments to update one LongTermMemory.
     * @example
     * // Update one LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends LongTermMemoryUpdateArgs>(args: SelectSubset<T, LongTermMemoryUpdateArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more LongTermMemories.
     * @param {LongTermMemoryDeleteManyArgs} args - Arguments to filter LongTermMemories to delete.
     * @example
     * // Delete a few LongTermMemories
     * const { count } = await prisma.longTermMemory.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends LongTermMemoryDeleteManyArgs>(args?: SelectSubset<T, LongTermMemoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LongTermMemories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many LongTermMemories
     * const longTermMemory = await prisma.longTermMemory.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends LongTermMemoryUpdateManyArgs>(args: SelectSubset<T, LongTermMemoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more LongTermMemories and returns the data updated in the database.
     * @param {LongTermMemoryUpdateManyAndReturnArgs} args - Arguments to update many LongTermMemories.
     * @example
     * // Update many LongTermMemories
     * const longTermMemory = await prisma.longTermMemory.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more LongTermMemories and only return the `id`
     * const longTermMemoryWithIdOnly = await prisma.longTermMemory.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends LongTermMemoryUpdateManyAndReturnArgs>(args: SelectSubset<T, LongTermMemoryUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one LongTermMemory.
     * @param {LongTermMemoryUpsertArgs} args - Arguments to update or create a LongTermMemory.
     * @example
     * // Update or create a LongTermMemory
     * const longTermMemory = await prisma.longTermMemory.upsert({
     *   create: {
     *     // ... data to create a LongTermMemory
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the LongTermMemory we want to update
     *   }
     * })
     */
    upsert<T extends LongTermMemoryUpsertArgs>(args: SelectSubset<T, LongTermMemoryUpsertArgs<ExtArgs>>): Prisma__LongTermMemoryClient<$Result.GetResult<Prisma.$LongTermMemoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of LongTermMemories.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryCountArgs} args - Arguments to filter LongTermMemories to count.
     * @example
     * // Count the number of LongTermMemories
     * const count = await prisma.longTermMemory.count({
     *   where: {
     *     // ... the filter for the LongTermMemories we want to count
     *   }
     * })
    **/
    count<T extends LongTermMemoryCountArgs>(
      args?: Subset<T, LongTermMemoryCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], LongTermMemoryCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a LongTermMemory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends LongTermMemoryAggregateArgs>(args: Subset<T, LongTermMemoryAggregateArgs>): Prisma.PrismaPromise<GetLongTermMemoryAggregateType<T>>

    /**
     * Group by LongTermMemory.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {LongTermMemoryGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends LongTermMemoryGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: LongTermMemoryGroupByArgs['orderBy'] }
        : { orderBy?: LongTermMemoryGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, LongTermMemoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetLongTermMemoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the LongTermMemory model
   */
  readonly fields: LongTermMemoryFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for LongTermMemory.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__LongTermMemoryClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the LongTermMemory model
   */
  interface LongTermMemoryFieldRefs {
    readonly id: FieldRef<"LongTermMemory", 'String'>
    readonly userId: FieldRef<"LongTermMemory", 'String'>
    readonly type: FieldRef<"LongTermMemory", 'String'>
    readonly content: FieldRef<"LongTermMemory", 'String'>
    readonly confidence: FieldRef<"LongTermMemory", 'Float'>
    readonly createdAt: FieldRef<"LongTermMemory", 'DateTime'>
    readonly lastAccessed: FieldRef<"LongTermMemory", 'DateTime'>
    readonly accessCount: FieldRef<"LongTermMemory", 'Int'>
  }
    

  // Custom InputTypes
  /**
   * LongTermMemory findUnique
   */
  export type LongTermMemoryFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter, which LongTermMemory to fetch.
     */
    where: LongTermMemoryWhereUniqueInput
  }

  /**
   * LongTermMemory findUniqueOrThrow
   */
  export type LongTermMemoryFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter, which LongTermMemory to fetch.
     */
    where: LongTermMemoryWhereUniqueInput
  }

  /**
   * LongTermMemory findFirst
   */
  export type LongTermMemoryFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter, which LongTermMemory to fetch.
     */
    where?: LongTermMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LongTermMemories to fetch.
     */
    orderBy?: LongTermMemoryOrderByWithRelationInput | LongTermMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LongTermMemories.
     */
    cursor?: LongTermMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LongTermMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LongTermMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LongTermMemories.
     */
    distinct?: LongTermMemoryScalarFieldEnum | LongTermMemoryScalarFieldEnum[]
  }

  /**
   * LongTermMemory findFirstOrThrow
   */
  export type LongTermMemoryFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter, which LongTermMemory to fetch.
     */
    where?: LongTermMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LongTermMemories to fetch.
     */
    orderBy?: LongTermMemoryOrderByWithRelationInput | LongTermMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for LongTermMemories.
     */
    cursor?: LongTermMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LongTermMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LongTermMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LongTermMemories.
     */
    distinct?: LongTermMemoryScalarFieldEnum | LongTermMemoryScalarFieldEnum[]
  }

  /**
   * LongTermMemory findMany
   */
  export type LongTermMemoryFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter, which LongTermMemories to fetch.
     */
    where?: LongTermMemoryWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of LongTermMemories to fetch.
     */
    orderBy?: LongTermMemoryOrderByWithRelationInput | LongTermMemoryOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing LongTermMemories.
     */
    cursor?: LongTermMemoryWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` LongTermMemories from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` LongTermMemories.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of LongTermMemories.
     */
    distinct?: LongTermMemoryScalarFieldEnum | LongTermMemoryScalarFieldEnum[]
  }

  /**
   * LongTermMemory create
   */
  export type LongTermMemoryCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * The data needed to create a LongTermMemory.
     */
    data: XOR<LongTermMemoryCreateInput, LongTermMemoryUncheckedCreateInput>
  }

  /**
   * LongTermMemory createMany
   */
  export type LongTermMemoryCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many LongTermMemories.
     */
    data: LongTermMemoryCreateManyInput | LongTermMemoryCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * LongTermMemory createManyAndReturn
   */
  export type LongTermMemoryCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * The data used to create many LongTermMemories.
     */
    data: LongTermMemoryCreateManyInput | LongTermMemoryCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * LongTermMemory update
   */
  export type LongTermMemoryUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * The data needed to update a LongTermMemory.
     */
    data: XOR<LongTermMemoryUpdateInput, LongTermMemoryUncheckedUpdateInput>
    /**
     * Choose, which LongTermMemory to update.
     */
    where: LongTermMemoryWhereUniqueInput
  }

  /**
   * LongTermMemory updateMany
   */
  export type LongTermMemoryUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update LongTermMemories.
     */
    data: XOR<LongTermMemoryUpdateManyMutationInput, LongTermMemoryUncheckedUpdateManyInput>
    /**
     * Filter which LongTermMemories to update
     */
    where?: LongTermMemoryWhereInput
    /**
     * Limit how many LongTermMemories to update.
     */
    limit?: number
  }

  /**
   * LongTermMemory updateManyAndReturn
   */
  export type LongTermMemoryUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * The data used to update LongTermMemories.
     */
    data: XOR<LongTermMemoryUpdateManyMutationInput, LongTermMemoryUncheckedUpdateManyInput>
    /**
     * Filter which LongTermMemories to update
     */
    where?: LongTermMemoryWhereInput
    /**
     * Limit how many LongTermMemories to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * LongTermMemory upsert
   */
  export type LongTermMemoryUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * The filter to search for the LongTermMemory to update in case it exists.
     */
    where: LongTermMemoryWhereUniqueInput
    /**
     * In case the LongTermMemory found by the `where` argument doesn't exist, create a new LongTermMemory with this data.
     */
    create: XOR<LongTermMemoryCreateInput, LongTermMemoryUncheckedCreateInput>
    /**
     * In case the LongTermMemory was found with the provided `where` argument, update it with this data.
     */
    update: XOR<LongTermMemoryUpdateInput, LongTermMemoryUncheckedUpdateInput>
  }

  /**
   * LongTermMemory delete
   */
  export type LongTermMemoryDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
    /**
     * Filter which LongTermMemory to delete.
     */
    where: LongTermMemoryWhereUniqueInput
  }

  /**
   * LongTermMemory deleteMany
   */
  export type LongTermMemoryDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which LongTermMemories to delete
     */
    where?: LongTermMemoryWhereInput
    /**
     * Limit how many LongTermMemories to delete.
     */
    limit?: number
  }

  /**
   * LongTermMemory without action
   */
  export type LongTermMemoryDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the LongTermMemory
     */
    select?: LongTermMemorySelect<ExtArgs> | null
    /**
     * Omit specific fields from the LongTermMemory
     */
    omit?: LongTermMemoryOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: LongTermMemoryInclude<ExtArgs> | null
  }


  /**
   * Model ResearchJobRecord
   */

  export type AggregateResearchJobRecord = {
    _count: ResearchJobRecordCountAggregateOutputType | null
    _min: ResearchJobRecordMinAggregateOutputType | null
    _max: ResearchJobRecordMaxAggregateOutputType | null
  }

  export type ResearchJobRecordMinAggregateOutputType = {
    id: string | null
    userId: string | null
    query: string | null
    report: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ResearchJobRecordMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    query: string | null
    report: string | null
    status: string | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type ResearchJobRecordCountAggregateOutputType = {
    id: number
    userId: number
    query: number
    plan: number
    report: number
    sources: number
    stats: number
    verificationReport: number
    status: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type ResearchJobRecordMinAggregateInputType = {
    id?: true
    userId?: true
    query?: true
    report?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ResearchJobRecordMaxAggregateInputType = {
    id?: true
    userId?: true
    query?: true
    report?: true
    status?: true
    createdAt?: true
    updatedAt?: true
  }

  export type ResearchJobRecordCountAggregateInputType = {
    id?: true
    userId?: true
    query?: true
    plan?: true
    report?: true
    sources?: true
    stats?: true
    verificationReport?: true
    status?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type ResearchJobRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ResearchJobRecord to aggregate.
     */
    where?: ResearchJobRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResearchJobRecords to fetch.
     */
    orderBy?: ResearchJobRecordOrderByWithRelationInput | ResearchJobRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: ResearchJobRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResearchJobRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResearchJobRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned ResearchJobRecords
    **/
    _count?: true | ResearchJobRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: ResearchJobRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: ResearchJobRecordMaxAggregateInputType
  }

  export type GetResearchJobRecordAggregateType<T extends ResearchJobRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateResearchJobRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateResearchJobRecord[P]>
      : GetScalarType<T[P], AggregateResearchJobRecord[P]>
  }




  export type ResearchJobRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: ResearchJobRecordWhereInput
    orderBy?: ResearchJobRecordOrderByWithAggregationInput | ResearchJobRecordOrderByWithAggregationInput[]
    by: ResearchJobRecordScalarFieldEnum[] | ResearchJobRecordScalarFieldEnum
    having?: ResearchJobRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: ResearchJobRecordCountAggregateInputType | true
    _min?: ResearchJobRecordMinAggregateInputType
    _max?: ResearchJobRecordMaxAggregateInputType
  }

  export type ResearchJobRecordGroupByOutputType = {
    id: string
    userId: string
    query: string
    plan: JsonValue | null
    report: string | null
    sources: JsonValue | null
    stats: JsonValue | null
    verificationReport: JsonValue | null
    status: string
    createdAt: Date
    updatedAt: Date
    _count: ResearchJobRecordCountAggregateOutputType | null
    _min: ResearchJobRecordMinAggregateOutputType | null
    _max: ResearchJobRecordMaxAggregateOutputType | null
  }

  type GetResearchJobRecordGroupByPayload<T extends ResearchJobRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<ResearchJobRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof ResearchJobRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], ResearchJobRecordGroupByOutputType[P]>
            : GetScalarType<T[P], ResearchJobRecordGroupByOutputType[P]>
        }
      >
    >


  export type ResearchJobRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    query?: boolean
    plan?: boolean
    report?: boolean
    sources?: boolean
    stats?: boolean
    verificationReport?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["researchJobRecord"]>

  export type ResearchJobRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    query?: boolean
    plan?: boolean
    report?: boolean
    sources?: boolean
    stats?: boolean
    verificationReport?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["researchJobRecord"]>

  export type ResearchJobRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    query?: boolean
    plan?: boolean
    report?: boolean
    sources?: boolean
    stats?: boolean
    verificationReport?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["researchJobRecord"]>

  export type ResearchJobRecordSelectScalar = {
    id?: boolean
    userId?: boolean
    query?: boolean
    plan?: boolean
    report?: boolean
    sources?: boolean
    stats?: boolean
    verificationReport?: boolean
    status?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type ResearchJobRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "query" | "plan" | "report" | "sources" | "stats" | "verificationReport" | "status" | "createdAt" | "updatedAt", ExtArgs["result"]["researchJobRecord"]>
  export type ResearchJobRecordInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ResearchJobRecordIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type ResearchJobRecordIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $ResearchJobRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "ResearchJobRecord"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      query: string
      plan: Prisma.JsonValue | null
      report: string | null
      sources: Prisma.JsonValue | null
      stats: Prisma.JsonValue | null
      verificationReport: Prisma.JsonValue | null
      status: string
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["researchJobRecord"]>
    composites: {}
  }

  type ResearchJobRecordGetPayload<S extends boolean | null | undefined | ResearchJobRecordDefaultArgs> = $Result.GetResult<Prisma.$ResearchJobRecordPayload, S>

  type ResearchJobRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<ResearchJobRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: ResearchJobRecordCountAggregateInputType | true
    }

  export interface ResearchJobRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['ResearchJobRecord'], meta: { name: 'ResearchJobRecord' } }
    /**
     * Find zero or one ResearchJobRecord that matches the filter.
     * @param {ResearchJobRecordFindUniqueArgs} args - Arguments to find a ResearchJobRecord
     * @example
     * // Get one ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends ResearchJobRecordFindUniqueArgs>(args: SelectSubset<T, ResearchJobRecordFindUniqueArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one ResearchJobRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {ResearchJobRecordFindUniqueOrThrowArgs} args - Arguments to find a ResearchJobRecord
     * @example
     * // Get one ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends ResearchJobRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, ResearchJobRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ResearchJobRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordFindFirstArgs} args - Arguments to find a ResearchJobRecord
     * @example
     * // Get one ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends ResearchJobRecordFindFirstArgs>(args?: SelectSubset<T, ResearchJobRecordFindFirstArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first ResearchJobRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordFindFirstOrThrowArgs} args - Arguments to find a ResearchJobRecord
     * @example
     * // Get one ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends ResearchJobRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, ResearchJobRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more ResearchJobRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all ResearchJobRecords
     * const researchJobRecords = await prisma.researchJobRecord.findMany()
     * 
     * // Get first 10 ResearchJobRecords
     * const researchJobRecords = await prisma.researchJobRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const researchJobRecordWithIdOnly = await prisma.researchJobRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends ResearchJobRecordFindManyArgs>(args?: SelectSubset<T, ResearchJobRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a ResearchJobRecord.
     * @param {ResearchJobRecordCreateArgs} args - Arguments to create a ResearchJobRecord.
     * @example
     * // Create one ResearchJobRecord
     * const ResearchJobRecord = await prisma.researchJobRecord.create({
     *   data: {
     *     // ... data to create a ResearchJobRecord
     *   }
     * })
     * 
     */
    create<T extends ResearchJobRecordCreateArgs>(args: SelectSubset<T, ResearchJobRecordCreateArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many ResearchJobRecords.
     * @param {ResearchJobRecordCreateManyArgs} args - Arguments to create many ResearchJobRecords.
     * @example
     * // Create many ResearchJobRecords
     * const researchJobRecord = await prisma.researchJobRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends ResearchJobRecordCreateManyArgs>(args?: SelectSubset<T, ResearchJobRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many ResearchJobRecords and returns the data saved in the database.
     * @param {ResearchJobRecordCreateManyAndReturnArgs} args - Arguments to create many ResearchJobRecords.
     * @example
     * // Create many ResearchJobRecords
     * const researchJobRecord = await prisma.researchJobRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many ResearchJobRecords and only return the `id`
     * const researchJobRecordWithIdOnly = await prisma.researchJobRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends ResearchJobRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, ResearchJobRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a ResearchJobRecord.
     * @param {ResearchJobRecordDeleteArgs} args - Arguments to delete one ResearchJobRecord.
     * @example
     * // Delete one ResearchJobRecord
     * const ResearchJobRecord = await prisma.researchJobRecord.delete({
     *   where: {
     *     // ... filter to delete one ResearchJobRecord
     *   }
     * })
     * 
     */
    delete<T extends ResearchJobRecordDeleteArgs>(args: SelectSubset<T, ResearchJobRecordDeleteArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one ResearchJobRecord.
     * @param {ResearchJobRecordUpdateArgs} args - Arguments to update one ResearchJobRecord.
     * @example
     * // Update one ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends ResearchJobRecordUpdateArgs>(args: SelectSubset<T, ResearchJobRecordUpdateArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more ResearchJobRecords.
     * @param {ResearchJobRecordDeleteManyArgs} args - Arguments to filter ResearchJobRecords to delete.
     * @example
     * // Delete a few ResearchJobRecords
     * const { count } = await prisma.researchJobRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends ResearchJobRecordDeleteManyArgs>(args?: SelectSubset<T, ResearchJobRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ResearchJobRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many ResearchJobRecords
     * const researchJobRecord = await prisma.researchJobRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends ResearchJobRecordUpdateManyArgs>(args: SelectSubset<T, ResearchJobRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more ResearchJobRecords and returns the data updated in the database.
     * @param {ResearchJobRecordUpdateManyAndReturnArgs} args - Arguments to update many ResearchJobRecords.
     * @example
     * // Update many ResearchJobRecords
     * const researchJobRecord = await prisma.researchJobRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more ResearchJobRecords and only return the `id`
     * const researchJobRecordWithIdOnly = await prisma.researchJobRecord.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends ResearchJobRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, ResearchJobRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one ResearchJobRecord.
     * @param {ResearchJobRecordUpsertArgs} args - Arguments to update or create a ResearchJobRecord.
     * @example
     * // Update or create a ResearchJobRecord
     * const researchJobRecord = await prisma.researchJobRecord.upsert({
     *   create: {
     *     // ... data to create a ResearchJobRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the ResearchJobRecord we want to update
     *   }
     * })
     */
    upsert<T extends ResearchJobRecordUpsertArgs>(args: SelectSubset<T, ResearchJobRecordUpsertArgs<ExtArgs>>): Prisma__ResearchJobRecordClient<$Result.GetResult<Prisma.$ResearchJobRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of ResearchJobRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordCountArgs} args - Arguments to filter ResearchJobRecords to count.
     * @example
     * // Count the number of ResearchJobRecords
     * const count = await prisma.researchJobRecord.count({
     *   where: {
     *     // ... the filter for the ResearchJobRecords we want to count
     *   }
     * })
    **/
    count<T extends ResearchJobRecordCountArgs>(
      args?: Subset<T, ResearchJobRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], ResearchJobRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a ResearchJobRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends ResearchJobRecordAggregateArgs>(args: Subset<T, ResearchJobRecordAggregateArgs>): Prisma.PrismaPromise<GetResearchJobRecordAggregateType<T>>

    /**
     * Group by ResearchJobRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {ResearchJobRecordGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends ResearchJobRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: ResearchJobRecordGroupByArgs['orderBy'] }
        : { orderBy?: ResearchJobRecordGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, ResearchJobRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetResearchJobRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the ResearchJobRecord model
   */
  readonly fields: ResearchJobRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for ResearchJobRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__ResearchJobRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the ResearchJobRecord model
   */
  interface ResearchJobRecordFieldRefs {
    readonly id: FieldRef<"ResearchJobRecord", 'String'>
    readonly userId: FieldRef<"ResearchJobRecord", 'String'>
    readonly query: FieldRef<"ResearchJobRecord", 'String'>
    readonly plan: FieldRef<"ResearchJobRecord", 'Json'>
    readonly report: FieldRef<"ResearchJobRecord", 'String'>
    readonly sources: FieldRef<"ResearchJobRecord", 'Json'>
    readonly stats: FieldRef<"ResearchJobRecord", 'Json'>
    readonly verificationReport: FieldRef<"ResearchJobRecord", 'Json'>
    readonly status: FieldRef<"ResearchJobRecord", 'String'>
    readonly createdAt: FieldRef<"ResearchJobRecord", 'DateTime'>
    readonly updatedAt: FieldRef<"ResearchJobRecord", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * ResearchJobRecord findUnique
   */
  export type ResearchJobRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter, which ResearchJobRecord to fetch.
     */
    where: ResearchJobRecordWhereUniqueInput
  }

  /**
   * ResearchJobRecord findUniqueOrThrow
   */
  export type ResearchJobRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter, which ResearchJobRecord to fetch.
     */
    where: ResearchJobRecordWhereUniqueInput
  }

  /**
   * ResearchJobRecord findFirst
   */
  export type ResearchJobRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter, which ResearchJobRecord to fetch.
     */
    where?: ResearchJobRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResearchJobRecords to fetch.
     */
    orderBy?: ResearchJobRecordOrderByWithRelationInput | ResearchJobRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ResearchJobRecords.
     */
    cursor?: ResearchJobRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResearchJobRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResearchJobRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ResearchJobRecords.
     */
    distinct?: ResearchJobRecordScalarFieldEnum | ResearchJobRecordScalarFieldEnum[]
  }

  /**
   * ResearchJobRecord findFirstOrThrow
   */
  export type ResearchJobRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter, which ResearchJobRecord to fetch.
     */
    where?: ResearchJobRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResearchJobRecords to fetch.
     */
    orderBy?: ResearchJobRecordOrderByWithRelationInput | ResearchJobRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for ResearchJobRecords.
     */
    cursor?: ResearchJobRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResearchJobRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResearchJobRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ResearchJobRecords.
     */
    distinct?: ResearchJobRecordScalarFieldEnum | ResearchJobRecordScalarFieldEnum[]
  }

  /**
   * ResearchJobRecord findMany
   */
  export type ResearchJobRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter, which ResearchJobRecords to fetch.
     */
    where?: ResearchJobRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of ResearchJobRecords to fetch.
     */
    orderBy?: ResearchJobRecordOrderByWithRelationInput | ResearchJobRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing ResearchJobRecords.
     */
    cursor?: ResearchJobRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` ResearchJobRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` ResearchJobRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of ResearchJobRecords.
     */
    distinct?: ResearchJobRecordScalarFieldEnum | ResearchJobRecordScalarFieldEnum[]
  }

  /**
   * ResearchJobRecord create
   */
  export type ResearchJobRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * The data needed to create a ResearchJobRecord.
     */
    data: XOR<ResearchJobRecordCreateInput, ResearchJobRecordUncheckedCreateInput>
  }

  /**
   * ResearchJobRecord createMany
   */
  export type ResearchJobRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many ResearchJobRecords.
     */
    data: ResearchJobRecordCreateManyInput | ResearchJobRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * ResearchJobRecord createManyAndReturn
   */
  export type ResearchJobRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * The data used to create many ResearchJobRecords.
     */
    data: ResearchJobRecordCreateManyInput | ResearchJobRecordCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * ResearchJobRecord update
   */
  export type ResearchJobRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * The data needed to update a ResearchJobRecord.
     */
    data: XOR<ResearchJobRecordUpdateInput, ResearchJobRecordUncheckedUpdateInput>
    /**
     * Choose, which ResearchJobRecord to update.
     */
    where: ResearchJobRecordWhereUniqueInput
  }

  /**
   * ResearchJobRecord updateMany
   */
  export type ResearchJobRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update ResearchJobRecords.
     */
    data: XOR<ResearchJobRecordUpdateManyMutationInput, ResearchJobRecordUncheckedUpdateManyInput>
    /**
     * Filter which ResearchJobRecords to update
     */
    where?: ResearchJobRecordWhereInput
    /**
     * Limit how many ResearchJobRecords to update.
     */
    limit?: number
  }

  /**
   * ResearchJobRecord updateManyAndReturn
   */
  export type ResearchJobRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * The data used to update ResearchJobRecords.
     */
    data: XOR<ResearchJobRecordUpdateManyMutationInput, ResearchJobRecordUncheckedUpdateManyInput>
    /**
     * Filter which ResearchJobRecords to update
     */
    where?: ResearchJobRecordWhereInput
    /**
     * Limit how many ResearchJobRecords to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * ResearchJobRecord upsert
   */
  export type ResearchJobRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * The filter to search for the ResearchJobRecord to update in case it exists.
     */
    where: ResearchJobRecordWhereUniqueInput
    /**
     * In case the ResearchJobRecord found by the `where` argument doesn't exist, create a new ResearchJobRecord with this data.
     */
    create: XOR<ResearchJobRecordCreateInput, ResearchJobRecordUncheckedCreateInput>
    /**
     * In case the ResearchJobRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<ResearchJobRecordUpdateInput, ResearchJobRecordUncheckedUpdateInput>
  }

  /**
   * ResearchJobRecord delete
   */
  export type ResearchJobRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
    /**
     * Filter which ResearchJobRecord to delete.
     */
    where: ResearchJobRecordWhereUniqueInput
  }

  /**
   * ResearchJobRecord deleteMany
   */
  export type ResearchJobRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which ResearchJobRecords to delete
     */
    where?: ResearchJobRecordWhereInput
    /**
     * Limit how many ResearchJobRecords to delete.
     */
    limit?: number
  }

  /**
   * ResearchJobRecord without action
   */
  export type ResearchJobRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the ResearchJobRecord
     */
    select?: ResearchJobRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the ResearchJobRecord
     */
    omit?: ResearchJobRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: ResearchJobRecordInclude<ExtArgs> | null
  }


  /**
   * Model DocumentRecord
   */

  export type AggregateDocumentRecord = {
    _count: DocumentRecordCountAggregateOutputType | null
    _avg: DocumentRecordAvgAggregateOutputType | null
    _sum: DocumentRecordSumAggregateOutputType | null
    _min: DocumentRecordMinAggregateOutputType | null
    _max: DocumentRecordMaxAggregateOutputType | null
  }

  export type DocumentRecordAvgAggregateOutputType = {
    size: number | null
    textLength: number | null
  }

  export type DocumentRecordSumAggregateOutputType = {
    size: number | null
    textLength: number | null
  }

  export type DocumentRecordMinAggregateOutputType = {
    id: string | null
    userId: string | null
    filename: string | null
    mimeType: string | null
    size: number | null
    text: string | null
    textLength: number | null
    createdAt: Date | null
  }

  export type DocumentRecordMaxAggregateOutputType = {
    id: string | null
    userId: string | null
    filename: string | null
    mimeType: string | null
    size: number | null
    text: string | null
    textLength: number | null
    createdAt: Date | null
  }

  export type DocumentRecordCountAggregateOutputType = {
    id: number
    userId: number
    filename: number
    mimeType: number
    size: number
    text: number
    textLength: number
    createdAt: number
    _all: number
  }


  export type DocumentRecordAvgAggregateInputType = {
    size?: true
    textLength?: true
  }

  export type DocumentRecordSumAggregateInputType = {
    size?: true
    textLength?: true
  }

  export type DocumentRecordMinAggregateInputType = {
    id?: true
    userId?: true
    filename?: true
    mimeType?: true
    size?: true
    text?: true
    textLength?: true
    createdAt?: true
  }

  export type DocumentRecordMaxAggregateInputType = {
    id?: true
    userId?: true
    filename?: true
    mimeType?: true
    size?: true
    text?: true
    textLength?: true
    createdAt?: true
  }

  export type DocumentRecordCountAggregateInputType = {
    id?: true
    userId?: true
    filename?: true
    mimeType?: true
    size?: true
    text?: true
    textLength?: true
    createdAt?: true
    _all?: true
  }

  export type DocumentRecordAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DocumentRecord to aggregate.
     */
    where?: DocumentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DocumentRecords to fetch.
     */
    orderBy?: DocumentRecordOrderByWithRelationInput | DocumentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: DocumentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DocumentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DocumentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned DocumentRecords
    **/
    _count?: true | DocumentRecordCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: DocumentRecordAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: DocumentRecordSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: DocumentRecordMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: DocumentRecordMaxAggregateInputType
  }

  export type GetDocumentRecordAggregateType<T extends DocumentRecordAggregateArgs> = {
        [P in keyof T & keyof AggregateDocumentRecord]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateDocumentRecord[P]>
      : GetScalarType<T[P], AggregateDocumentRecord[P]>
  }




  export type DocumentRecordGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: DocumentRecordWhereInput
    orderBy?: DocumentRecordOrderByWithAggregationInput | DocumentRecordOrderByWithAggregationInput[]
    by: DocumentRecordScalarFieldEnum[] | DocumentRecordScalarFieldEnum
    having?: DocumentRecordScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: DocumentRecordCountAggregateInputType | true
    _avg?: DocumentRecordAvgAggregateInputType
    _sum?: DocumentRecordSumAggregateInputType
    _min?: DocumentRecordMinAggregateInputType
    _max?: DocumentRecordMaxAggregateInputType
  }

  export type DocumentRecordGroupByOutputType = {
    id: string
    userId: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt: Date
    _count: DocumentRecordCountAggregateOutputType | null
    _avg: DocumentRecordAvgAggregateOutputType | null
    _sum: DocumentRecordSumAggregateOutputType | null
    _min: DocumentRecordMinAggregateOutputType | null
    _max: DocumentRecordMaxAggregateOutputType | null
  }

  type GetDocumentRecordGroupByPayload<T extends DocumentRecordGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<DocumentRecordGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof DocumentRecordGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], DocumentRecordGroupByOutputType[P]>
            : GetScalarType<T[P], DocumentRecordGroupByOutputType[P]>
        }
      >
    >


  export type DocumentRecordSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    filename?: boolean
    mimeType?: boolean
    size?: boolean
    text?: boolean
    textLength?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["documentRecord"]>

  export type DocumentRecordSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    filename?: boolean
    mimeType?: boolean
    size?: boolean
    text?: boolean
    textLength?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["documentRecord"]>

  export type DocumentRecordSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    userId?: boolean
    filename?: boolean
    mimeType?: boolean
    size?: boolean
    text?: boolean
    textLength?: boolean
    createdAt?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["documentRecord"]>

  export type DocumentRecordSelectScalar = {
    id?: boolean
    userId?: boolean
    filename?: boolean
    mimeType?: boolean
    size?: boolean
    text?: boolean
    textLength?: boolean
    createdAt?: boolean
  }

  export type DocumentRecordOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "userId" | "filename" | "mimeType" | "size" | "text" | "textLength" | "createdAt", ExtArgs["result"]["documentRecord"]>
  export type DocumentRecordInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type DocumentRecordIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type DocumentRecordIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $DocumentRecordPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "DocumentRecord"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      id: string
      userId: string
      filename: string
      mimeType: string
      size: number
      text: string
      textLength: number
      createdAt: Date
    }, ExtArgs["result"]["documentRecord"]>
    composites: {}
  }

  type DocumentRecordGetPayload<S extends boolean | null | undefined | DocumentRecordDefaultArgs> = $Result.GetResult<Prisma.$DocumentRecordPayload, S>

  type DocumentRecordCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<DocumentRecordFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: DocumentRecordCountAggregateInputType | true
    }

  export interface DocumentRecordDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['DocumentRecord'], meta: { name: 'DocumentRecord' } }
    /**
     * Find zero or one DocumentRecord that matches the filter.
     * @param {DocumentRecordFindUniqueArgs} args - Arguments to find a DocumentRecord
     * @example
     * // Get one DocumentRecord
     * const documentRecord = await prisma.documentRecord.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends DocumentRecordFindUniqueArgs>(args: SelectSubset<T, DocumentRecordFindUniqueArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one DocumentRecord that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {DocumentRecordFindUniqueOrThrowArgs} args - Arguments to find a DocumentRecord
     * @example
     * // Get one DocumentRecord
     * const documentRecord = await prisma.documentRecord.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends DocumentRecordFindUniqueOrThrowArgs>(args: SelectSubset<T, DocumentRecordFindUniqueOrThrowArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DocumentRecord that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordFindFirstArgs} args - Arguments to find a DocumentRecord
     * @example
     * // Get one DocumentRecord
     * const documentRecord = await prisma.documentRecord.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends DocumentRecordFindFirstArgs>(args?: SelectSubset<T, DocumentRecordFindFirstArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first DocumentRecord that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordFindFirstOrThrowArgs} args - Arguments to find a DocumentRecord
     * @example
     * // Get one DocumentRecord
     * const documentRecord = await prisma.documentRecord.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends DocumentRecordFindFirstOrThrowArgs>(args?: SelectSubset<T, DocumentRecordFindFirstOrThrowArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more DocumentRecords that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all DocumentRecords
     * const documentRecords = await prisma.documentRecord.findMany()
     * 
     * // Get first 10 DocumentRecords
     * const documentRecords = await prisma.documentRecord.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const documentRecordWithIdOnly = await prisma.documentRecord.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends DocumentRecordFindManyArgs>(args?: SelectSubset<T, DocumentRecordFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a DocumentRecord.
     * @param {DocumentRecordCreateArgs} args - Arguments to create a DocumentRecord.
     * @example
     * // Create one DocumentRecord
     * const DocumentRecord = await prisma.documentRecord.create({
     *   data: {
     *     // ... data to create a DocumentRecord
     *   }
     * })
     * 
     */
    create<T extends DocumentRecordCreateArgs>(args: SelectSubset<T, DocumentRecordCreateArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many DocumentRecords.
     * @param {DocumentRecordCreateManyArgs} args - Arguments to create many DocumentRecords.
     * @example
     * // Create many DocumentRecords
     * const documentRecord = await prisma.documentRecord.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends DocumentRecordCreateManyArgs>(args?: SelectSubset<T, DocumentRecordCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many DocumentRecords and returns the data saved in the database.
     * @param {DocumentRecordCreateManyAndReturnArgs} args - Arguments to create many DocumentRecords.
     * @example
     * // Create many DocumentRecords
     * const documentRecord = await prisma.documentRecord.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many DocumentRecords and only return the `id`
     * const documentRecordWithIdOnly = await prisma.documentRecord.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends DocumentRecordCreateManyAndReturnArgs>(args?: SelectSubset<T, DocumentRecordCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a DocumentRecord.
     * @param {DocumentRecordDeleteArgs} args - Arguments to delete one DocumentRecord.
     * @example
     * // Delete one DocumentRecord
     * const DocumentRecord = await prisma.documentRecord.delete({
     *   where: {
     *     // ... filter to delete one DocumentRecord
     *   }
     * })
     * 
     */
    delete<T extends DocumentRecordDeleteArgs>(args: SelectSubset<T, DocumentRecordDeleteArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one DocumentRecord.
     * @param {DocumentRecordUpdateArgs} args - Arguments to update one DocumentRecord.
     * @example
     * // Update one DocumentRecord
     * const documentRecord = await prisma.documentRecord.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends DocumentRecordUpdateArgs>(args: SelectSubset<T, DocumentRecordUpdateArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more DocumentRecords.
     * @param {DocumentRecordDeleteManyArgs} args - Arguments to filter DocumentRecords to delete.
     * @example
     * // Delete a few DocumentRecords
     * const { count } = await prisma.documentRecord.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends DocumentRecordDeleteManyArgs>(args?: SelectSubset<T, DocumentRecordDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DocumentRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many DocumentRecords
     * const documentRecord = await prisma.documentRecord.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends DocumentRecordUpdateManyArgs>(args: SelectSubset<T, DocumentRecordUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more DocumentRecords and returns the data updated in the database.
     * @param {DocumentRecordUpdateManyAndReturnArgs} args - Arguments to update many DocumentRecords.
     * @example
     * // Update many DocumentRecords
     * const documentRecord = await prisma.documentRecord.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more DocumentRecords and only return the `id`
     * const documentRecordWithIdOnly = await prisma.documentRecord.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends DocumentRecordUpdateManyAndReturnArgs>(args: SelectSubset<T, DocumentRecordUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one DocumentRecord.
     * @param {DocumentRecordUpsertArgs} args - Arguments to update or create a DocumentRecord.
     * @example
     * // Update or create a DocumentRecord
     * const documentRecord = await prisma.documentRecord.upsert({
     *   create: {
     *     // ... data to create a DocumentRecord
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the DocumentRecord we want to update
     *   }
     * })
     */
    upsert<T extends DocumentRecordUpsertArgs>(args: SelectSubset<T, DocumentRecordUpsertArgs<ExtArgs>>): Prisma__DocumentRecordClient<$Result.GetResult<Prisma.$DocumentRecordPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of DocumentRecords.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordCountArgs} args - Arguments to filter DocumentRecords to count.
     * @example
     * // Count the number of DocumentRecords
     * const count = await prisma.documentRecord.count({
     *   where: {
     *     // ... the filter for the DocumentRecords we want to count
     *   }
     * })
    **/
    count<T extends DocumentRecordCountArgs>(
      args?: Subset<T, DocumentRecordCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], DocumentRecordCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a DocumentRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends DocumentRecordAggregateArgs>(args: Subset<T, DocumentRecordAggregateArgs>): Prisma.PrismaPromise<GetDocumentRecordAggregateType<T>>

    /**
     * Group by DocumentRecord.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {DocumentRecordGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends DocumentRecordGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: DocumentRecordGroupByArgs['orderBy'] }
        : { orderBy?: DocumentRecordGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, DocumentRecordGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetDocumentRecordGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the DocumentRecord model
   */
  readonly fields: DocumentRecordFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for DocumentRecord.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__DocumentRecordClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the DocumentRecord model
   */
  interface DocumentRecordFieldRefs {
    readonly id: FieldRef<"DocumentRecord", 'String'>
    readonly userId: FieldRef<"DocumentRecord", 'String'>
    readonly filename: FieldRef<"DocumentRecord", 'String'>
    readonly mimeType: FieldRef<"DocumentRecord", 'String'>
    readonly size: FieldRef<"DocumentRecord", 'Int'>
    readonly text: FieldRef<"DocumentRecord", 'String'>
    readonly textLength: FieldRef<"DocumentRecord", 'Int'>
    readonly createdAt: FieldRef<"DocumentRecord", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * DocumentRecord findUnique
   */
  export type DocumentRecordFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter, which DocumentRecord to fetch.
     */
    where: DocumentRecordWhereUniqueInput
  }

  /**
   * DocumentRecord findUniqueOrThrow
   */
  export type DocumentRecordFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter, which DocumentRecord to fetch.
     */
    where: DocumentRecordWhereUniqueInput
  }

  /**
   * DocumentRecord findFirst
   */
  export type DocumentRecordFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter, which DocumentRecord to fetch.
     */
    where?: DocumentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DocumentRecords to fetch.
     */
    orderBy?: DocumentRecordOrderByWithRelationInput | DocumentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DocumentRecords.
     */
    cursor?: DocumentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DocumentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DocumentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DocumentRecords.
     */
    distinct?: DocumentRecordScalarFieldEnum | DocumentRecordScalarFieldEnum[]
  }

  /**
   * DocumentRecord findFirstOrThrow
   */
  export type DocumentRecordFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter, which DocumentRecord to fetch.
     */
    where?: DocumentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DocumentRecords to fetch.
     */
    orderBy?: DocumentRecordOrderByWithRelationInput | DocumentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for DocumentRecords.
     */
    cursor?: DocumentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DocumentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DocumentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DocumentRecords.
     */
    distinct?: DocumentRecordScalarFieldEnum | DocumentRecordScalarFieldEnum[]
  }

  /**
   * DocumentRecord findMany
   */
  export type DocumentRecordFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter, which DocumentRecords to fetch.
     */
    where?: DocumentRecordWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of DocumentRecords to fetch.
     */
    orderBy?: DocumentRecordOrderByWithRelationInput | DocumentRecordOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing DocumentRecords.
     */
    cursor?: DocumentRecordWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` DocumentRecords from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` DocumentRecords.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of DocumentRecords.
     */
    distinct?: DocumentRecordScalarFieldEnum | DocumentRecordScalarFieldEnum[]
  }

  /**
   * DocumentRecord create
   */
  export type DocumentRecordCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * The data needed to create a DocumentRecord.
     */
    data: XOR<DocumentRecordCreateInput, DocumentRecordUncheckedCreateInput>
  }

  /**
   * DocumentRecord createMany
   */
  export type DocumentRecordCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many DocumentRecords.
     */
    data: DocumentRecordCreateManyInput | DocumentRecordCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * DocumentRecord createManyAndReturn
   */
  export type DocumentRecordCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * The data used to create many DocumentRecords.
     */
    data: DocumentRecordCreateManyInput | DocumentRecordCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * DocumentRecord update
   */
  export type DocumentRecordUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * The data needed to update a DocumentRecord.
     */
    data: XOR<DocumentRecordUpdateInput, DocumentRecordUncheckedUpdateInput>
    /**
     * Choose, which DocumentRecord to update.
     */
    where: DocumentRecordWhereUniqueInput
  }

  /**
   * DocumentRecord updateMany
   */
  export type DocumentRecordUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update DocumentRecords.
     */
    data: XOR<DocumentRecordUpdateManyMutationInput, DocumentRecordUncheckedUpdateManyInput>
    /**
     * Filter which DocumentRecords to update
     */
    where?: DocumentRecordWhereInput
    /**
     * Limit how many DocumentRecords to update.
     */
    limit?: number
  }

  /**
   * DocumentRecord updateManyAndReturn
   */
  export type DocumentRecordUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * The data used to update DocumentRecords.
     */
    data: XOR<DocumentRecordUpdateManyMutationInput, DocumentRecordUncheckedUpdateManyInput>
    /**
     * Filter which DocumentRecords to update
     */
    where?: DocumentRecordWhereInput
    /**
     * Limit how many DocumentRecords to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * DocumentRecord upsert
   */
  export type DocumentRecordUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * The filter to search for the DocumentRecord to update in case it exists.
     */
    where: DocumentRecordWhereUniqueInput
    /**
     * In case the DocumentRecord found by the `where` argument doesn't exist, create a new DocumentRecord with this data.
     */
    create: XOR<DocumentRecordCreateInput, DocumentRecordUncheckedCreateInput>
    /**
     * In case the DocumentRecord was found with the provided `where` argument, update it with this data.
     */
    update: XOR<DocumentRecordUpdateInput, DocumentRecordUncheckedUpdateInput>
  }

  /**
   * DocumentRecord delete
   */
  export type DocumentRecordDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
    /**
     * Filter which DocumentRecord to delete.
     */
    where: DocumentRecordWhereUniqueInput
  }

  /**
   * DocumentRecord deleteMany
   */
  export type DocumentRecordDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which DocumentRecords to delete
     */
    where?: DocumentRecordWhereInput
    /**
     * Limit how many DocumentRecords to delete.
     */
    limit?: number
  }

  /**
   * DocumentRecord without action
   */
  export type DocumentRecordDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the DocumentRecord
     */
    select?: DocumentRecordSelect<ExtArgs> | null
    /**
     * Omit specific fields from the DocumentRecord
     */
    omit?: DocumentRecordOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: DocumentRecordInclude<ExtArgs> | null
  }


  /**
   * Model UserPreference
   */

  export type AggregateUserPreference = {
    _count: UserPreferenceCountAggregateOutputType | null
    _min: UserPreferenceMinAggregateOutputType | null
    _max: UserPreferenceMaxAggregateOutputType | null
  }

  export type UserPreferenceMinAggregateOutputType = {
    userId: string | null
    preferredLanguage: string | null
    preferredDepth: string | null
    preferredFormat: string | null
    preferredProvider: string | null
    timezone: string | null
  }

  export type UserPreferenceMaxAggregateOutputType = {
    userId: string | null
    preferredLanguage: string | null
    preferredDepth: string | null
    preferredFormat: string | null
    preferredProvider: string | null
    timezone: string | null
  }

  export type UserPreferenceCountAggregateOutputType = {
    userId: number
    preferredLanguage: number
    preferredDepth: number
    preferredFormat: number
    preferredProvider: number
    timezone: number
    _all: number
  }


  export type UserPreferenceMinAggregateInputType = {
    userId?: true
    preferredLanguage?: true
    preferredDepth?: true
    preferredFormat?: true
    preferredProvider?: true
    timezone?: true
  }

  export type UserPreferenceMaxAggregateInputType = {
    userId?: true
    preferredLanguage?: true
    preferredDepth?: true
    preferredFormat?: true
    preferredProvider?: true
    timezone?: true
  }

  export type UserPreferenceCountAggregateInputType = {
    userId?: true
    preferredLanguage?: true
    preferredDepth?: true
    preferredFormat?: true
    preferredProvider?: true
    timezone?: true
    _all?: true
  }

  export type UserPreferenceAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserPreference to aggregate.
     */
    where?: UserPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPreferences to fetch.
     */
    orderBy?: UserPreferenceOrderByWithRelationInput | UserPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: UserPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned UserPreferences
    **/
    _count?: true | UserPreferenceCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: UserPreferenceMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: UserPreferenceMaxAggregateInputType
  }

  export type GetUserPreferenceAggregateType<T extends UserPreferenceAggregateArgs> = {
        [P in keyof T & keyof AggregateUserPreference]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateUserPreference[P]>
      : GetScalarType<T[P], AggregateUserPreference[P]>
  }




  export type UserPreferenceGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: UserPreferenceWhereInput
    orderBy?: UserPreferenceOrderByWithAggregationInput | UserPreferenceOrderByWithAggregationInput[]
    by: UserPreferenceScalarFieldEnum[] | UserPreferenceScalarFieldEnum
    having?: UserPreferenceScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: UserPreferenceCountAggregateInputType | true
    _min?: UserPreferenceMinAggregateInputType
    _max?: UserPreferenceMaxAggregateInputType
  }

  export type UserPreferenceGroupByOutputType = {
    userId: string
    preferredLanguage: string | null
    preferredDepth: string | null
    preferredFormat: string | null
    preferredProvider: string | null
    timezone: string | null
    _count: UserPreferenceCountAggregateOutputType | null
    _min: UserPreferenceMinAggregateOutputType | null
    _max: UserPreferenceMaxAggregateOutputType | null
  }

  type GetUserPreferenceGroupByPayload<T extends UserPreferenceGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<UserPreferenceGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof UserPreferenceGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], UserPreferenceGroupByOutputType[P]>
            : GetScalarType<T[P], UserPreferenceGroupByOutputType[P]>
        }
      >
    >


  export type UserPreferenceSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    preferredLanguage?: boolean
    preferredDepth?: boolean
    preferredFormat?: boolean
    preferredProvider?: boolean
    timezone?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPreference"]>

  export type UserPreferenceSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    preferredLanguage?: boolean
    preferredDepth?: boolean
    preferredFormat?: boolean
    preferredProvider?: boolean
    timezone?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPreference"]>

  export type UserPreferenceSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    userId?: boolean
    preferredLanguage?: boolean
    preferredDepth?: boolean
    preferredFormat?: boolean
    preferredProvider?: boolean
    timezone?: boolean
    user?: boolean | UserDefaultArgs<ExtArgs>
  }, ExtArgs["result"]["userPreference"]>

  export type UserPreferenceSelectScalar = {
    userId?: boolean
    preferredLanguage?: boolean
    preferredDepth?: boolean
    preferredFormat?: boolean
    preferredProvider?: boolean
    timezone?: boolean
  }

  export type UserPreferenceOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"userId" | "preferredLanguage" | "preferredDepth" | "preferredFormat" | "preferredProvider" | "timezone", ExtArgs["result"]["userPreference"]>
  export type UserPreferenceInclude<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type UserPreferenceIncludeCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }
  export type UserPreferenceIncludeUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    user?: boolean | UserDefaultArgs<ExtArgs>
  }

  export type $UserPreferencePayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "UserPreference"
    objects: {
      user: Prisma.$UserPayload<ExtArgs>
    }
    scalars: $Extensions.GetPayloadResult<{
      userId: string
      preferredLanguage: string | null
      preferredDepth: string | null
      preferredFormat: string | null
      preferredProvider: string | null
      timezone: string | null
    }, ExtArgs["result"]["userPreference"]>
    composites: {}
  }

  type UserPreferenceGetPayload<S extends boolean | null | undefined | UserPreferenceDefaultArgs> = $Result.GetResult<Prisma.$UserPreferencePayload, S>

  type UserPreferenceCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<UserPreferenceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: UserPreferenceCountAggregateInputType | true
    }

  export interface UserPreferenceDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['UserPreference'], meta: { name: 'UserPreference' } }
    /**
     * Find zero or one UserPreference that matches the filter.
     * @param {UserPreferenceFindUniqueArgs} args - Arguments to find a UserPreference
     * @example
     * // Get one UserPreference
     * const userPreference = await prisma.userPreference.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends UserPreferenceFindUniqueArgs>(args: SelectSubset<T, UserPreferenceFindUniqueArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one UserPreference that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {UserPreferenceFindUniqueOrThrowArgs} args - Arguments to find a UserPreference
     * @example
     * // Get one UserPreference
     * const userPreference = await prisma.userPreference.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends UserPreferenceFindUniqueOrThrowArgs>(args: SelectSubset<T, UserPreferenceFindUniqueOrThrowArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserPreference that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceFindFirstArgs} args - Arguments to find a UserPreference
     * @example
     * // Get one UserPreference
     * const userPreference = await prisma.userPreference.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends UserPreferenceFindFirstArgs>(args?: SelectSubset<T, UserPreferenceFindFirstArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first UserPreference that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceFindFirstOrThrowArgs} args - Arguments to find a UserPreference
     * @example
     * // Get one UserPreference
     * const userPreference = await prisma.userPreference.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends UserPreferenceFindFirstOrThrowArgs>(args?: SelectSubset<T, UserPreferenceFindFirstOrThrowArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more UserPreferences that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all UserPreferences
     * const userPreferences = await prisma.userPreference.findMany()
     * 
     * // Get first 10 UserPreferences
     * const userPreferences = await prisma.userPreference.findMany({ take: 10 })
     * 
     * // Only select the `userId`
     * const userPreferenceWithUserIdOnly = await prisma.userPreference.findMany({ select: { userId: true } })
     * 
     */
    findMany<T extends UserPreferenceFindManyArgs>(args?: SelectSubset<T, UserPreferenceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a UserPreference.
     * @param {UserPreferenceCreateArgs} args - Arguments to create a UserPreference.
     * @example
     * // Create one UserPreference
     * const UserPreference = await prisma.userPreference.create({
     *   data: {
     *     // ... data to create a UserPreference
     *   }
     * })
     * 
     */
    create<T extends UserPreferenceCreateArgs>(args: SelectSubset<T, UserPreferenceCreateArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many UserPreferences.
     * @param {UserPreferenceCreateManyArgs} args - Arguments to create many UserPreferences.
     * @example
     * // Create many UserPreferences
     * const userPreference = await prisma.userPreference.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends UserPreferenceCreateManyArgs>(args?: SelectSubset<T, UserPreferenceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many UserPreferences and returns the data saved in the database.
     * @param {UserPreferenceCreateManyAndReturnArgs} args - Arguments to create many UserPreferences.
     * @example
     * // Create many UserPreferences
     * const userPreference = await prisma.userPreference.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many UserPreferences and only return the `userId`
     * const userPreferenceWithUserIdOnly = await prisma.userPreference.createManyAndReturn({
     *   select: { userId: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends UserPreferenceCreateManyAndReturnArgs>(args?: SelectSubset<T, UserPreferenceCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a UserPreference.
     * @param {UserPreferenceDeleteArgs} args - Arguments to delete one UserPreference.
     * @example
     * // Delete one UserPreference
     * const UserPreference = await prisma.userPreference.delete({
     *   where: {
     *     // ... filter to delete one UserPreference
     *   }
     * })
     * 
     */
    delete<T extends UserPreferenceDeleteArgs>(args: SelectSubset<T, UserPreferenceDeleteArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one UserPreference.
     * @param {UserPreferenceUpdateArgs} args - Arguments to update one UserPreference.
     * @example
     * // Update one UserPreference
     * const userPreference = await prisma.userPreference.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends UserPreferenceUpdateArgs>(args: SelectSubset<T, UserPreferenceUpdateArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more UserPreferences.
     * @param {UserPreferenceDeleteManyArgs} args - Arguments to filter UserPreferences to delete.
     * @example
     * // Delete a few UserPreferences
     * const { count } = await prisma.userPreference.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends UserPreferenceDeleteManyArgs>(args?: SelectSubset<T, UserPreferenceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserPreferences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many UserPreferences
     * const userPreference = await prisma.userPreference.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends UserPreferenceUpdateManyArgs>(args: SelectSubset<T, UserPreferenceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more UserPreferences and returns the data updated in the database.
     * @param {UserPreferenceUpdateManyAndReturnArgs} args - Arguments to update many UserPreferences.
     * @example
     * // Update many UserPreferences
     * const userPreference = await prisma.userPreference.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more UserPreferences and only return the `userId`
     * const userPreferenceWithUserIdOnly = await prisma.userPreference.updateManyAndReturn({
     *   select: { userId: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends UserPreferenceUpdateManyAndReturnArgs>(args: SelectSubset<T, UserPreferenceUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one UserPreference.
     * @param {UserPreferenceUpsertArgs} args - Arguments to update or create a UserPreference.
     * @example
     * // Update or create a UserPreference
     * const userPreference = await prisma.userPreference.upsert({
     *   create: {
     *     // ... data to create a UserPreference
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the UserPreference we want to update
     *   }
     * })
     */
    upsert<T extends UserPreferenceUpsertArgs>(args: SelectSubset<T, UserPreferenceUpsertArgs<ExtArgs>>): Prisma__UserPreferenceClient<$Result.GetResult<Prisma.$UserPreferencePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of UserPreferences.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceCountArgs} args - Arguments to filter UserPreferences to count.
     * @example
     * // Count the number of UserPreferences
     * const count = await prisma.userPreference.count({
     *   where: {
     *     // ... the filter for the UserPreferences we want to count
     *   }
     * })
    **/
    count<T extends UserPreferenceCountArgs>(
      args?: Subset<T, UserPreferenceCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], UserPreferenceCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a UserPreference.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends UserPreferenceAggregateArgs>(args: Subset<T, UserPreferenceAggregateArgs>): Prisma.PrismaPromise<GetUserPreferenceAggregateType<T>>

    /**
     * Group by UserPreference.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {UserPreferenceGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends UserPreferenceGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: UserPreferenceGroupByArgs['orderBy'] }
        : { orderBy?: UserPreferenceGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, UserPreferenceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserPreferenceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the UserPreference model
   */
  readonly fields: UserPreferenceFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for UserPreference.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__UserPreferenceClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    user<T extends UserDefaultArgs<ExtArgs> = {}>(args?: Subset<T, UserDefaultArgs<ExtArgs>>): Prisma__UserClient<$Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the UserPreference model
   */
  interface UserPreferenceFieldRefs {
    readonly userId: FieldRef<"UserPreference", 'String'>
    readonly preferredLanguage: FieldRef<"UserPreference", 'String'>
    readonly preferredDepth: FieldRef<"UserPreference", 'String'>
    readonly preferredFormat: FieldRef<"UserPreference", 'String'>
    readonly preferredProvider: FieldRef<"UserPreference", 'String'>
    readonly timezone: FieldRef<"UserPreference", 'String'>
  }
    

  // Custom InputTypes
  /**
   * UserPreference findUnique
   */
  export type UserPreferenceFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserPreference to fetch.
     */
    where: UserPreferenceWhereUniqueInput
  }

  /**
   * UserPreference findUniqueOrThrow
   */
  export type UserPreferenceFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserPreference to fetch.
     */
    where: UserPreferenceWhereUniqueInput
  }

  /**
   * UserPreference findFirst
   */
  export type UserPreferenceFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserPreference to fetch.
     */
    where?: UserPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPreferences to fetch.
     */
    orderBy?: UserPreferenceOrderByWithRelationInput | UserPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserPreferences.
     */
    cursor?: UserPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPreferences.
     */
    distinct?: UserPreferenceScalarFieldEnum | UserPreferenceScalarFieldEnum[]
  }

  /**
   * UserPreference findFirstOrThrow
   */
  export type UserPreferenceFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserPreference to fetch.
     */
    where?: UserPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPreferences to fetch.
     */
    orderBy?: UserPreferenceOrderByWithRelationInput | UserPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for UserPreferences.
     */
    cursor?: UserPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPreferences.
     */
    distinct?: UserPreferenceScalarFieldEnum | UserPreferenceScalarFieldEnum[]
  }

  /**
   * UserPreference findMany
   */
  export type UserPreferenceFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter, which UserPreferences to fetch.
     */
    where?: UserPreferenceWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of UserPreferences to fetch.
     */
    orderBy?: UserPreferenceOrderByWithRelationInput | UserPreferenceOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing UserPreferences.
     */
    cursor?: UserPreferenceWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` UserPreferences from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` UserPreferences.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of UserPreferences.
     */
    distinct?: UserPreferenceScalarFieldEnum | UserPreferenceScalarFieldEnum[]
  }

  /**
   * UserPreference create
   */
  export type UserPreferenceCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * The data needed to create a UserPreference.
     */
    data: XOR<UserPreferenceCreateInput, UserPreferenceUncheckedCreateInput>
  }

  /**
   * UserPreference createMany
   */
  export type UserPreferenceCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many UserPreferences.
     */
    data: UserPreferenceCreateManyInput | UserPreferenceCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * UserPreference createManyAndReturn
   */
  export type UserPreferenceCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * The data used to create many UserPreferences.
     */
    data: UserPreferenceCreateManyInput | UserPreferenceCreateManyInput[]
    skipDuplicates?: boolean
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceIncludeCreateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserPreference update
   */
  export type UserPreferenceUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * The data needed to update a UserPreference.
     */
    data: XOR<UserPreferenceUpdateInput, UserPreferenceUncheckedUpdateInput>
    /**
     * Choose, which UserPreference to update.
     */
    where: UserPreferenceWhereUniqueInput
  }

  /**
   * UserPreference updateMany
   */
  export type UserPreferenceUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update UserPreferences.
     */
    data: XOR<UserPreferenceUpdateManyMutationInput, UserPreferenceUncheckedUpdateManyInput>
    /**
     * Filter which UserPreferences to update
     */
    where?: UserPreferenceWhereInput
    /**
     * Limit how many UserPreferences to update.
     */
    limit?: number
  }

  /**
   * UserPreference updateManyAndReturn
   */
  export type UserPreferenceUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * The data used to update UserPreferences.
     */
    data: XOR<UserPreferenceUpdateManyMutationInput, UserPreferenceUncheckedUpdateManyInput>
    /**
     * Filter which UserPreferences to update
     */
    where?: UserPreferenceWhereInput
    /**
     * Limit how many UserPreferences to update.
     */
    limit?: number
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceIncludeUpdateManyAndReturn<ExtArgs> | null
  }

  /**
   * UserPreference upsert
   */
  export type UserPreferenceUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * The filter to search for the UserPreference to update in case it exists.
     */
    where: UserPreferenceWhereUniqueInput
    /**
     * In case the UserPreference found by the `where` argument doesn't exist, create a new UserPreference with this data.
     */
    create: XOR<UserPreferenceCreateInput, UserPreferenceUncheckedCreateInput>
    /**
     * In case the UserPreference was found with the provided `where` argument, update it with this data.
     */
    update: XOR<UserPreferenceUpdateInput, UserPreferenceUncheckedUpdateInput>
  }

  /**
   * UserPreference delete
   */
  export type UserPreferenceDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
    /**
     * Filter which UserPreference to delete.
     */
    where: UserPreferenceWhereUniqueInput
  }

  /**
   * UserPreference deleteMany
   */
  export type UserPreferenceDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which UserPreferences to delete
     */
    where?: UserPreferenceWhereInput
    /**
     * Limit how many UserPreferences to delete.
     */
    limit?: number
  }

  /**
   * UserPreference without action
   */
  export type UserPreferenceDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the UserPreference
     */
    select?: UserPreferenceSelect<ExtArgs> | null
    /**
     * Omit specific fields from the UserPreference
     */
    omit?: UserPreferenceOmit<ExtArgs> | null
    /**
     * Choose, which related nodes to fetch as well
     */
    include?: UserPreferenceInclude<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const UserScalarFieldEnum: {
    id: 'id',
    email: 'email',
    name: 'name',
    passwordHash: 'passwordHash',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum]


  export const ConversationScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    title: 'title',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ConversationScalarFieldEnum = (typeof ConversationScalarFieldEnum)[keyof typeof ConversationScalarFieldEnum]


  export const MessageScalarFieldEnum: {
    id: 'id',
    conversationId: 'conversationId',
    role: 'role',
    content: 'content',
    tokensUsed: 'tokensUsed',
    modelUsed: 'modelUsed',
    createdAt: 'createdAt'
  };

  export type MessageScalarFieldEnum = (typeof MessageScalarFieldEnum)[keyof typeof MessageScalarFieldEnum]


  export const LongTermMemoryScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    type: 'type',
    content: 'content',
    confidence: 'confidence',
    createdAt: 'createdAt',
    lastAccessed: 'lastAccessed',
    accessCount: 'accessCount'
  };

  export type LongTermMemoryScalarFieldEnum = (typeof LongTermMemoryScalarFieldEnum)[keyof typeof LongTermMemoryScalarFieldEnum]


  export const ResearchJobRecordScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    query: 'query',
    plan: 'plan',
    report: 'report',
    sources: 'sources',
    stats: 'stats',
    verificationReport: 'verificationReport',
    status: 'status',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type ResearchJobRecordScalarFieldEnum = (typeof ResearchJobRecordScalarFieldEnum)[keyof typeof ResearchJobRecordScalarFieldEnum]


  export const DocumentRecordScalarFieldEnum: {
    id: 'id',
    userId: 'userId',
    filename: 'filename',
    mimeType: 'mimeType',
    size: 'size',
    text: 'text',
    textLength: 'textLength',
    createdAt: 'createdAt'
  };

  export type DocumentRecordScalarFieldEnum = (typeof DocumentRecordScalarFieldEnum)[keyof typeof DocumentRecordScalarFieldEnum]


  export const UserPreferenceScalarFieldEnum: {
    userId: 'userId',
    preferredLanguage: 'preferredLanguage',
    preferredDepth: 'preferredDepth',
    preferredFormat: 'preferredFormat',
    preferredProvider: 'preferredProvider',
    timezone: 'timezone'
  };

  export type UserPreferenceScalarFieldEnum = (typeof UserPreferenceScalarFieldEnum)[keyof typeof UserPreferenceScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const NullableJsonNullValueInput: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull
  };

  export type NullableJsonNullValueInput = (typeof NullableJsonNullValueInput)[keyof typeof NullableJsonNullValueInput]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  export const JsonNullValueFilter: {
    DbNull: typeof DbNull,
    JsonNull: typeof JsonNull,
    AnyNull: typeof AnyNull
  };

  export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Json'
   */
  export type JsonFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Json'>
    


  /**
   * Reference to a field of type 'QueryMode'
   */
  export type EnumQueryModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'QueryMode'>
    
  /**
   * Deep Input Types
   */


  export type UserWhereInput = {
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    id?: StringFilter<"User"> | string
    email?: StringNullableFilter<"User"> | string | null
    name?: StringNullableFilter<"User"> | string | null
    passwordHash?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    conversations?: ConversationListRelationFilter
    researchJobs?: ResearchJobRecordListRelationFilter
    documents?: DocumentRecordListRelationFilter
    preferences?: XOR<UserPreferenceNullableScalarRelationFilter, UserPreferenceWhereInput> | null
    memories?: LongTermMemoryListRelationFilter
  }

  export type UserOrderByWithRelationInput = {
    id?: SortOrder
    email?: SortOrderInput | SortOrder
    name?: SortOrderInput | SortOrder
    passwordHash?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    conversations?: ConversationOrderByRelationAggregateInput
    researchJobs?: ResearchJobRecordOrderByRelationAggregateInput
    documents?: DocumentRecordOrderByRelationAggregateInput
    preferences?: UserPreferenceOrderByWithRelationInput
    memories?: LongTermMemoryOrderByRelationAggregateInput
  }

  export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    email?: string
    AND?: UserWhereInput | UserWhereInput[]
    OR?: UserWhereInput[]
    NOT?: UserWhereInput | UserWhereInput[]
    name?: StringNullableFilter<"User"> | string | null
    passwordHash?: StringNullableFilter<"User"> | string | null
    createdAt?: DateTimeFilter<"User"> | Date | string
    updatedAt?: DateTimeFilter<"User"> | Date | string
    conversations?: ConversationListRelationFilter
    researchJobs?: ResearchJobRecordListRelationFilter
    documents?: DocumentRecordListRelationFilter
    preferences?: XOR<UserPreferenceNullableScalarRelationFilter, UserPreferenceWhereInput> | null
    memories?: LongTermMemoryListRelationFilter
  }, "id" | "email">

  export type UserOrderByWithAggregationInput = {
    id?: SortOrder
    email?: SortOrderInput | SortOrder
    name?: SortOrderInput | SortOrder
    passwordHash?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: UserCountOrderByAggregateInput
    _max?: UserMaxOrderByAggregateInput
    _min?: UserMinOrderByAggregateInput
  }

  export type UserScalarWhereWithAggregatesInput = {
    AND?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    OR?: UserScalarWhereWithAggregatesInput[]
    NOT?: UserScalarWhereWithAggregatesInput | UserScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"User"> | string
    email?: StringNullableWithAggregatesFilter<"User"> | string | null
    name?: StringNullableWithAggregatesFilter<"User"> | string | null
    passwordHash?: StringNullableWithAggregatesFilter<"User"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"User"> | Date | string
  }

  export type ConversationWhereInput = {
    AND?: ConversationWhereInput | ConversationWhereInput[]
    OR?: ConversationWhereInput[]
    NOT?: ConversationWhereInput | ConversationWhereInput[]
    id?: StringFilter<"Conversation"> | string
    userId?: StringFilter<"Conversation"> | string
    title?: StringFilter<"Conversation"> | string
    createdAt?: DateTimeFilter<"Conversation"> | Date | string
    updatedAt?: DateTimeFilter<"Conversation"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    messages?: MessageListRelationFilter
  }

  export type ConversationOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
    messages?: MessageOrderByRelationAggregateInput
  }

  export type ConversationWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ConversationWhereInput | ConversationWhereInput[]
    OR?: ConversationWhereInput[]
    NOT?: ConversationWhereInput | ConversationWhereInput[]
    userId?: StringFilter<"Conversation"> | string
    title?: StringFilter<"Conversation"> | string
    createdAt?: DateTimeFilter<"Conversation"> | Date | string
    updatedAt?: DateTimeFilter<"Conversation"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
    messages?: MessageListRelationFilter
  }, "id">

  export type ConversationOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ConversationCountOrderByAggregateInput
    _max?: ConversationMaxOrderByAggregateInput
    _min?: ConversationMinOrderByAggregateInput
  }

  export type ConversationScalarWhereWithAggregatesInput = {
    AND?: ConversationScalarWhereWithAggregatesInput | ConversationScalarWhereWithAggregatesInput[]
    OR?: ConversationScalarWhereWithAggregatesInput[]
    NOT?: ConversationScalarWhereWithAggregatesInput | ConversationScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Conversation"> | string
    userId?: StringWithAggregatesFilter<"Conversation"> | string
    title?: StringWithAggregatesFilter<"Conversation"> | string
    createdAt?: DateTimeWithAggregatesFilter<"Conversation"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"Conversation"> | Date | string
  }

  export type MessageWhereInput = {
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    id?: StringFilter<"Message"> | string
    conversationId?: StringFilter<"Message"> | string
    role?: StringFilter<"Message"> | string
    content?: StringFilter<"Message"> | string
    tokensUsed?: IntFilter<"Message"> | number
    modelUsed?: StringNullableFilter<"Message"> | string | null
    createdAt?: DateTimeFilter<"Message"> | Date | string
    conversation?: XOR<ConversationScalarRelationFilter, ConversationWhereInput>
  }

  export type MessageOrderByWithRelationInput = {
    id?: SortOrder
    conversationId?: SortOrder
    role?: SortOrder
    content?: SortOrder
    tokensUsed?: SortOrder
    modelUsed?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    conversation?: ConversationOrderByWithRelationInput
  }

  export type MessageWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: MessageWhereInput | MessageWhereInput[]
    OR?: MessageWhereInput[]
    NOT?: MessageWhereInput | MessageWhereInput[]
    conversationId?: StringFilter<"Message"> | string
    role?: StringFilter<"Message"> | string
    content?: StringFilter<"Message"> | string
    tokensUsed?: IntFilter<"Message"> | number
    modelUsed?: StringNullableFilter<"Message"> | string | null
    createdAt?: DateTimeFilter<"Message"> | Date | string
    conversation?: XOR<ConversationScalarRelationFilter, ConversationWhereInput>
  }, "id">

  export type MessageOrderByWithAggregationInput = {
    id?: SortOrder
    conversationId?: SortOrder
    role?: SortOrder
    content?: SortOrder
    tokensUsed?: SortOrder
    modelUsed?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    _count?: MessageCountOrderByAggregateInput
    _avg?: MessageAvgOrderByAggregateInput
    _max?: MessageMaxOrderByAggregateInput
    _min?: MessageMinOrderByAggregateInput
    _sum?: MessageSumOrderByAggregateInput
  }

  export type MessageScalarWhereWithAggregatesInput = {
    AND?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    OR?: MessageScalarWhereWithAggregatesInput[]
    NOT?: MessageScalarWhereWithAggregatesInput | MessageScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Message"> | string
    conversationId?: StringWithAggregatesFilter<"Message"> | string
    role?: StringWithAggregatesFilter<"Message"> | string
    content?: StringWithAggregatesFilter<"Message"> | string
    tokensUsed?: IntWithAggregatesFilter<"Message"> | number
    modelUsed?: StringNullableWithAggregatesFilter<"Message"> | string | null
    createdAt?: DateTimeWithAggregatesFilter<"Message"> | Date | string
  }

  export type LongTermMemoryWhereInput = {
    AND?: LongTermMemoryWhereInput | LongTermMemoryWhereInput[]
    OR?: LongTermMemoryWhereInput[]
    NOT?: LongTermMemoryWhereInput | LongTermMemoryWhereInput[]
    id?: StringFilter<"LongTermMemory"> | string
    userId?: StringFilter<"LongTermMemory"> | string
    type?: StringFilter<"LongTermMemory"> | string
    content?: StringFilter<"LongTermMemory"> | string
    confidence?: FloatFilter<"LongTermMemory"> | number
    createdAt?: DateTimeFilter<"LongTermMemory"> | Date | string
    lastAccessed?: DateTimeNullableFilter<"LongTermMemory"> | Date | string | null
    accessCount?: IntFilter<"LongTermMemory"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type LongTermMemoryOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    content?: SortOrder
    confidence?: SortOrder
    createdAt?: SortOrder
    lastAccessed?: SortOrderInput | SortOrder
    accessCount?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type LongTermMemoryWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: LongTermMemoryWhereInput | LongTermMemoryWhereInput[]
    OR?: LongTermMemoryWhereInput[]
    NOT?: LongTermMemoryWhereInput | LongTermMemoryWhereInput[]
    userId?: StringFilter<"LongTermMemory"> | string
    type?: StringFilter<"LongTermMemory"> | string
    content?: StringFilter<"LongTermMemory"> | string
    confidence?: FloatFilter<"LongTermMemory"> | number
    createdAt?: DateTimeFilter<"LongTermMemory"> | Date | string
    lastAccessed?: DateTimeNullableFilter<"LongTermMemory"> | Date | string | null
    accessCount?: IntFilter<"LongTermMemory"> | number
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type LongTermMemoryOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    content?: SortOrder
    confidence?: SortOrder
    createdAt?: SortOrder
    lastAccessed?: SortOrderInput | SortOrder
    accessCount?: SortOrder
    _count?: LongTermMemoryCountOrderByAggregateInput
    _avg?: LongTermMemoryAvgOrderByAggregateInput
    _max?: LongTermMemoryMaxOrderByAggregateInput
    _min?: LongTermMemoryMinOrderByAggregateInput
    _sum?: LongTermMemorySumOrderByAggregateInput
  }

  export type LongTermMemoryScalarWhereWithAggregatesInput = {
    AND?: LongTermMemoryScalarWhereWithAggregatesInput | LongTermMemoryScalarWhereWithAggregatesInput[]
    OR?: LongTermMemoryScalarWhereWithAggregatesInput[]
    NOT?: LongTermMemoryScalarWhereWithAggregatesInput | LongTermMemoryScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"LongTermMemory"> | string
    userId?: StringWithAggregatesFilter<"LongTermMemory"> | string
    type?: StringWithAggregatesFilter<"LongTermMemory"> | string
    content?: StringWithAggregatesFilter<"LongTermMemory"> | string
    confidence?: FloatWithAggregatesFilter<"LongTermMemory"> | number
    createdAt?: DateTimeWithAggregatesFilter<"LongTermMemory"> | Date | string
    lastAccessed?: DateTimeNullableWithAggregatesFilter<"LongTermMemory"> | Date | string | null
    accessCount?: IntWithAggregatesFilter<"LongTermMemory"> | number
  }

  export type ResearchJobRecordWhereInput = {
    AND?: ResearchJobRecordWhereInput | ResearchJobRecordWhereInput[]
    OR?: ResearchJobRecordWhereInput[]
    NOT?: ResearchJobRecordWhereInput | ResearchJobRecordWhereInput[]
    id?: StringFilter<"ResearchJobRecord"> | string
    userId?: StringFilter<"ResearchJobRecord"> | string
    query?: StringFilter<"ResearchJobRecord"> | string
    plan?: JsonNullableFilter<"ResearchJobRecord">
    report?: StringNullableFilter<"ResearchJobRecord"> | string | null
    sources?: JsonNullableFilter<"ResearchJobRecord">
    stats?: JsonNullableFilter<"ResearchJobRecord">
    verificationReport?: JsonNullableFilter<"ResearchJobRecord">
    status?: StringFilter<"ResearchJobRecord"> | string
    createdAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
    updatedAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type ResearchJobRecordOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    query?: SortOrder
    plan?: SortOrderInput | SortOrder
    report?: SortOrderInput | SortOrder
    sources?: SortOrderInput | SortOrder
    stats?: SortOrderInput | SortOrder
    verificationReport?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type ResearchJobRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: ResearchJobRecordWhereInput | ResearchJobRecordWhereInput[]
    OR?: ResearchJobRecordWhereInput[]
    NOT?: ResearchJobRecordWhereInput | ResearchJobRecordWhereInput[]
    userId?: StringFilter<"ResearchJobRecord"> | string
    query?: StringFilter<"ResearchJobRecord"> | string
    plan?: JsonNullableFilter<"ResearchJobRecord">
    report?: StringNullableFilter<"ResearchJobRecord"> | string | null
    sources?: JsonNullableFilter<"ResearchJobRecord">
    stats?: JsonNullableFilter<"ResearchJobRecord">
    verificationReport?: JsonNullableFilter<"ResearchJobRecord">
    status?: StringFilter<"ResearchJobRecord"> | string
    createdAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
    updatedAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type ResearchJobRecordOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    query?: SortOrder
    plan?: SortOrderInput | SortOrder
    report?: SortOrderInput | SortOrder
    sources?: SortOrderInput | SortOrder
    stats?: SortOrderInput | SortOrder
    verificationReport?: SortOrderInput | SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: ResearchJobRecordCountOrderByAggregateInput
    _max?: ResearchJobRecordMaxOrderByAggregateInput
    _min?: ResearchJobRecordMinOrderByAggregateInput
  }

  export type ResearchJobRecordScalarWhereWithAggregatesInput = {
    AND?: ResearchJobRecordScalarWhereWithAggregatesInput | ResearchJobRecordScalarWhereWithAggregatesInput[]
    OR?: ResearchJobRecordScalarWhereWithAggregatesInput[]
    NOT?: ResearchJobRecordScalarWhereWithAggregatesInput | ResearchJobRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"ResearchJobRecord"> | string
    userId?: StringWithAggregatesFilter<"ResearchJobRecord"> | string
    query?: StringWithAggregatesFilter<"ResearchJobRecord"> | string
    plan?: JsonNullableWithAggregatesFilter<"ResearchJobRecord">
    report?: StringNullableWithAggregatesFilter<"ResearchJobRecord"> | string | null
    sources?: JsonNullableWithAggregatesFilter<"ResearchJobRecord">
    stats?: JsonNullableWithAggregatesFilter<"ResearchJobRecord">
    verificationReport?: JsonNullableWithAggregatesFilter<"ResearchJobRecord">
    status?: StringWithAggregatesFilter<"ResearchJobRecord"> | string
    createdAt?: DateTimeWithAggregatesFilter<"ResearchJobRecord"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"ResearchJobRecord"> | Date | string
  }

  export type DocumentRecordWhereInput = {
    AND?: DocumentRecordWhereInput | DocumentRecordWhereInput[]
    OR?: DocumentRecordWhereInput[]
    NOT?: DocumentRecordWhereInput | DocumentRecordWhereInput[]
    id?: StringFilter<"DocumentRecord"> | string
    userId?: StringFilter<"DocumentRecord"> | string
    filename?: StringFilter<"DocumentRecord"> | string
    mimeType?: StringFilter<"DocumentRecord"> | string
    size?: IntFilter<"DocumentRecord"> | number
    text?: StringFilter<"DocumentRecord"> | string
    textLength?: IntFilter<"DocumentRecord"> | number
    createdAt?: DateTimeFilter<"DocumentRecord"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type DocumentRecordOrderByWithRelationInput = {
    id?: SortOrder
    userId?: SortOrder
    filename?: SortOrder
    mimeType?: SortOrder
    size?: SortOrder
    text?: SortOrder
    textLength?: SortOrder
    createdAt?: SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type DocumentRecordWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: DocumentRecordWhereInput | DocumentRecordWhereInput[]
    OR?: DocumentRecordWhereInput[]
    NOT?: DocumentRecordWhereInput | DocumentRecordWhereInput[]
    userId?: StringFilter<"DocumentRecord"> | string
    filename?: StringFilter<"DocumentRecord"> | string
    mimeType?: StringFilter<"DocumentRecord"> | string
    size?: IntFilter<"DocumentRecord"> | number
    text?: StringFilter<"DocumentRecord"> | string
    textLength?: IntFilter<"DocumentRecord"> | number
    createdAt?: DateTimeFilter<"DocumentRecord"> | Date | string
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "id">

  export type DocumentRecordOrderByWithAggregationInput = {
    id?: SortOrder
    userId?: SortOrder
    filename?: SortOrder
    mimeType?: SortOrder
    size?: SortOrder
    text?: SortOrder
    textLength?: SortOrder
    createdAt?: SortOrder
    _count?: DocumentRecordCountOrderByAggregateInput
    _avg?: DocumentRecordAvgOrderByAggregateInput
    _max?: DocumentRecordMaxOrderByAggregateInput
    _min?: DocumentRecordMinOrderByAggregateInput
    _sum?: DocumentRecordSumOrderByAggregateInput
  }

  export type DocumentRecordScalarWhereWithAggregatesInput = {
    AND?: DocumentRecordScalarWhereWithAggregatesInput | DocumentRecordScalarWhereWithAggregatesInput[]
    OR?: DocumentRecordScalarWhereWithAggregatesInput[]
    NOT?: DocumentRecordScalarWhereWithAggregatesInput | DocumentRecordScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"DocumentRecord"> | string
    userId?: StringWithAggregatesFilter<"DocumentRecord"> | string
    filename?: StringWithAggregatesFilter<"DocumentRecord"> | string
    mimeType?: StringWithAggregatesFilter<"DocumentRecord"> | string
    size?: IntWithAggregatesFilter<"DocumentRecord"> | number
    text?: StringWithAggregatesFilter<"DocumentRecord"> | string
    textLength?: IntWithAggregatesFilter<"DocumentRecord"> | number
    createdAt?: DateTimeWithAggregatesFilter<"DocumentRecord"> | Date | string
  }

  export type UserPreferenceWhereInput = {
    AND?: UserPreferenceWhereInput | UserPreferenceWhereInput[]
    OR?: UserPreferenceWhereInput[]
    NOT?: UserPreferenceWhereInput | UserPreferenceWhereInput[]
    userId?: StringFilter<"UserPreference"> | string
    preferredLanguage?: StringNullableFilter<"UserPreference"> | string | null
    preferredDepth?: StringNullableFilter<"UserPreference"> | string | null
    preferredFormat?: StringNullableFilter<"UserPreference"> | string | null
    preferredProvider?: StringNullableFilter<"UserPreference"> | string | null
    timezone?: StringNullableFilter<"UserPreference"> | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }

  export type UserPreferenceOrderByWithRelationInput = {
    userId?: SortOrder
    preferredLanguage?: SortOrderInput | SortOrder
    preferredDepth?: SortOrderInput | SortOrder
    preferredFormat?: SortOrderInput | SortOrder
    preferredProvider?: SortOrderInput | SortOrder
    timezone?: SortOrderInput | SortOrder
    user?: UserOrderByWithRelationInput
  }

  export type UserPreferenceWhereUniqueInput = Prisma.AtLeast<{
    userId?: string
    AND?: UserPreferenceWhereInput | UserPreferenceWhereInput[]
    OR?: UserPreferenceWhereInput[]
    NOT?: UserPreferenceWhereInput | UserPreferenceWhereInput[]
    preferredLanguage?: StringNullableFilter<"UserPreference"> | string | null
    preferredDepth?: StringNullableFilter<"UserPreference"> | string | null
    preferredFormat?: StringNullableFilter<"UserPreference"> | string | null
    preferredProvider?: StringNullableFilter<"UserPreference"> | string | null
    timezone?: StringNullableFilter<"UserPreference"> | string | null
    user?: XOR<UserScalarRelationFilter, UserWhereInput>
  }, "userId">

  export type UserPreferenceOrderByWithAggregationInput = {
    userId?: SortOrder
    preferredLanguage?: SortOrderInput | SortOrder
    preferredDepth?: SortOrderInput | SortOrder
    preferredFormat?: SortOrderInput | SortOrder
    preferredProvider?: SortOrderInput | SortOrder
    timezone?: SortOrderInput | SortOrder
    _count?: UserPreferenceCountOrderByAggregateInput
    _max?: UserPreferenceMaxOrderByAggregateInput
    _min?: UserPreferenceMinOrderByAggregateInput
  }

  export type UserPreferenceScalarWhereWithAggregatesInput = {
    AND?: UserPreferenceScalarWhereWithAggregatesInput | UserPreferenceScalarWhereWithAggregatesInput[]
    OR?: UserPreferenceScalarWhereWithAggregatesInput[]
    NOT?: UserPreferenceScalarWhereWithAggregatesInput | UserPreferenceScalarWhereWithAggregatesInput[]
    userId?: StringWithAggregatesFilter<"UserPreference"> | string
    preferredLanguage?: StringNullableWithAggregatesFilter<"UserPreference"> | string | null
    preferredDepth?: StringNullableWithAggregatesFilter<"UserPreference"> | string | null
    preferredFormat?: StringNullableWithAggregatesFilter<"UserPreference"> | string | null
    preferredProvider?: StringNullableWithAggregatesFilter<"UserPreference"> | string | null
    timezone?: StringNullableWithAggregatesFilter<"UserPreference"> | string | null
  }

  export type UserCreateInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordCreateNestedManyWithoutUserInput
    documents?: DocumentRecordCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationUncheckedCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput
    documents?: DocumentRecordUncheckedCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceUncheckedCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUncheckedUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUncheckedUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUncheckedUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateManyInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type UserUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationCreateInput = {
    id?: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutConversationsInput
    messages?: MessageCreateNestedManyWithoutConversationInput
  }

  export type ConversationUncheckedCreateInput = {
    id?: string
    userId: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutConversationInput
  }

  export type ConversationUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutConversationsNestedInput
    messages?: MessageUpdateManyWithoutConversationNestedInput
  }

  export type ConversationUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutConversationNestedInput
  }

  export type ConversationCreateManyInput = {
    id?: string
    userId: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ConversationUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageCreateInput = {
    id?: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
    conversation: ConversationCreateNestedOneWithoutMessagesInput
  }

  export type MessageUncheckedCreateInput = {
    id?: string
    conversationId: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
  }

  export type MessageUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversation?: ConversationUpdateOneRequiredWithoutMessagesNestedInput
  }

  export type MessageUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    conversationId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageCreateManyInput = {
    id?: string
    conversationId: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
  }

  export type MessageUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    conversationId?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LongTermMemoryCreateInput = {
    id?: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
    user: UserCreateNestedOneWithoutMemoriesInput
  }

  export type LongTermMemoryUncheckedCreateInput = {
    id?: string
    userId: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
  }

  export type LongTermMemoryUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
    user?: UserUpdateOneRequiredWithoutMemoriesNestedInput
  }

  export type LongTermMemoryUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type LongTermMemoryCreateManyInput = {
    id?: string
    userId: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
  }

  export type LongTermMemoryUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type LongTermMemoryUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type ResearchJobRecordCreateInput = {
    id?: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutResearchJobsInput
  }

  export type ResearchJobRecordUncheckedCreateInput = {
    id?: string
    userId: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResearchJobRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutResearchJobsNestedInput
  }

  export type ResearchJobRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResearchJobRecordCreateManyInput = {
    id?: string
    userId: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResearchJobRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResearchJobRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordCreateInput = {
    id?: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
    user: UserCreateNestedOneWithoutDocumentsInput
  }

  export type DocumentRecordUncheckedCreateInput = {
    id?: string
    userId: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
  }

  export type DocumentRecordUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutDocumentsNestedInput
  }

  export type DocumentRecordUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordCreateManyInput = {
    id?: string
    userId: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
  }

  export type DocumentRecordUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserPreferenceCreateInput = {
    preferredLanguage?: string | null
    preferredDepth?: string | null
    preferredFormat?: string | null
    preferredProvider?: string | null
    timezone?: string | null
    user: UserCreateNestedOneWithoutPreferencesInput
  }

  export type UserPreferenceUncheckedCreateInput = {
    userId: string
    preferredLanguage?: string | null
    preferredDepth?: string | null
    preferredFormat?: string | null
    preferredProvider?: string | null
    timezone?: string | null
  }

  export type UserPreferenceUpdateInput = {
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
    user?: UserUpdateOneRequiredWithoutPreferencesNestedInput
  }

  export type UserPreferenceUncheckedUpdateInput = {
    userId?: StringFieldUpdateOperationsInput | string
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type UserPreferenceCreateManyInput = {
    userId: string
    preferredLanguage?: string | null
    preferredDepth?: string | null
    preferredFormat?: string | null
    preferredProvider?: string | null
    timezone?: string | null
  }

  export type UserPreferenceUpdateManyMutationInput = {
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type UserPreferenceUncheckedUpdateManyInput = {
    userId?: StringFieldUpdateOperationsInput | string
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type ConversationListRelationFilter = {
    every?: ConversationWhereInput
    some?: ConversationWhereInput
    none?: ConversationWhereInput
  }

  export type ResearchJobRecordListRelationFilter = {
    every?: ResearchJobRecordWhereInput
    some?: ResearchJobRecordWhereInput
    none?: ResearchJobRecordWhereInput
  }

  export type DocumentRecordListRelationFilter = {
    every?: DocumentRecordWhereInput
    some?: DocumentRecordWhereInput
    none?: DocumentRecordWhereInput
  }

  export type UserPreferenceNullableScalarRelationFilter = {
    is?: UserPreferenceWhereInput | null
    isNot?: UserPreferenceWhereInput | null
  }

  export type LongTermMemoryListRelationFilter = {
    every?: LongTermMemoryWhereInput
    some?: LongTermMemoryWhereInput
    none?: LongTermMemoryWhereInput
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type ConversationOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ResearchJobRecordOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type DocumentRecordOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type LongTermMemoryOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type UserCountOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMaxOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type UserMinOrderByAggregateInput = {
    id?: SortOrder
    email?: SortOrder
    name?: SortOrder
    passwordHash?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type UserScalarRelationFilter = {
    is?: UserWhereInput
    isNot?: UserWhereInput
  }

  export type MessageListRelationFilter = {
    every?: MessageWhereInput
    some?: MessageWhereInput
    none?: MessageWhereInput
  }

  export type MessageOrderByRelationAggregateInput = {
    _count?: SortOrder
  }

  export type ConversationCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ConversationMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ConversationMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    title?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type IntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type ConversationScalarRelationFilter = {
    is?: ConversationWhereInput
    isNot?: ConversationWhereInput
  }

  export type MessageCountOrderByAggregateInput = {
    id?: SortOrder
    conversationId?: SortOrder
    role?: SortOrder
    content?: SortOrder
    tokensUsed?: SortOrder
    modelUsed?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageAvgOrderByAggregateInput = {
    tokensUsed?: SortOrder
  }

  export type MessageMaxOrderByAggregateInput = {
    id?: SortOrder
    conversationId?: SortOrder
    role?: SortOrder
    content?: SortOrder
    tokensUsed?: SortOrder
    modelUsed?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageMinOrderByAggregateInput = {
    id?: SortOrder
    conversationId?: SortOrder
    role?: SortOrder
    content?: SortOrder
    tokensUsed?: SortOrder
    modelUsed?: SortOrder
    createdAt?: SortOrder
  }

  export type MessageSumOrderByAggregateInput = {
    tokensUsed?: SortOrder
  }

  export type IntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type LongTermMemoryCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    content?: SortOrder
    confidence?: SortOrder
    createdAt?: SortOrder
    lastAccessed?: SortOrder
    accessCount?: SortOrder
  }

  export type LongTermMemoryAvgOrderByAggregateInput = {
    confidence?: SortOrder
    accessCount?: SortOrder
  }

  export type LongTermMemoryMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    content?: SortOrder
    confidence?: SortOrder
    createdAt?: SortOrder
    lastAccessed?: SortOrder
    accessCount?: SortOrder
  }

  export type LongTermMemoryMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    type?: SortOrder
    content?: SortOrder
    confidence?: SortOrder
    createdAt?: SortOrder
    lastAccessed?: SortOrder
    accessCount?: SortOrder
  }

  export type LongTermMemorySumOrderByAggregateInput = {
    confidence?: SortOrder
    accessCount?: SortOrder
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }
  export type JsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type ResearchJobRecordCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    query?: SortOrder
    plan?: SortOrder
    report?: SortOrder
    sources?: SortOrder
    stats?: SortOrder
    verificationReport?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResearchJobRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    query?: SortOrder
    report?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type ResearchJobRecordMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    query?: SortOrder
    report?: SortOrder
    status?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }
  export type JsonNullableWithAggregatesFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, Exclude<keyof Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>,
        Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<JsonNullableWithAggregatesFilterBase<$PrismaModel>>, 'path'>>

  export type JsonNullableWithAggregatesFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedJsonNullableFilter<$PrismaModel>
    _max?: NestedJsonNullableFilter<$PrismaModel>
  }

  export type DocumentRecordCountOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    filename?: SortOrder
    mimeType?: SortOrder
    size?: SortOrder
    text?: SortOrder
    textLength?: SortOrder
    createdAt?: SortOrder
  }

  export type DocumentRecordAvgOrderByAggregateInput = {
    size?: SortOrder
    textLength?: SortOrder
  }

  export type DocumentRecordMaxOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    filename?: SortOrder
    mimeType?: SortOrder
    size?: SortOrder
    text?: SortOrder
    textLength?: SortOrder
    createdAt?: SortOrder
  }

  export type DocumentRecordMinOrderByAggregateInput = {
    id?: SortOrder
    userId?: SortOrder
    filename?: SortOrder
    mimeType?: SortOrder
    size?: SortOrder
    text?: SortOrder
    textLength?: SortOrder
    createdAt?: SortOrder
  }

  export type DocumentRecordSumOrderByAggregateInput = {
    size?: SortOrder
    textLength?: SortOrder
  }

  export type UserPreferenceCountOrderByAggregateInput = {
    userId?: SortOrder
    preferredLanguage?: SortOrder
    preferredDepth?: SortOrder
    preferredFormat?: SortOrder
    preferredProvider?: SortOrder
    timezone?: SortOrder
  }

  export type UserPreferenceMaxOrderByAggregateInput = {
    userId?: SortOrder
    preferredLanguage?: SortOrder
    preferredDepth?: SortOrder
    preferredFormat?: SortOrder
    preferredProvider?: SortOrder
    timezone?: SortOrder
  }

  export type UserPreferenceMinOrderByAggregateInput = {
    userId?: SortOrder
    preferredLanguage?: SortOrder
    preferredDepth?: SortOrder
    preferredFormat?: SortOrder
    preferredProvider?: SortOrder
    timezone?: SortOrder
  }

  export type ConversationCreateNestedManyWithoutUserInput = {
    create?: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput> | ConversationCreateWithoutUserInput[] | ConversationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ConversationCreateOrConnectWithoutUserInput | ConversationCreateOrConnectWithoutUserInput[]
    createMany?: ConversationCreateManyUserInputEnvelope
    connect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
  }

  export type ResearchJobRecordCreateNestedManyWithoutUserInput = {
    create?: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput> | ResearchJobRecordCreateWithoutUserInput[] | ResearchJobRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ResearchJobRecordCreateOrConnectWithoutUserInput | ResearchJobRecordCreateOrConnectWithoutUserInput[]
    createMany?: ResearchJobRecordCreateManyUserInputEnvelope
    connect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
  }

  export type DocumentRecordCreateNestedManyWithoutUserInput = {
    create?: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput> | DocumentRecordCreateWithoutUserInput[] | DocumentRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DocumentRecordCreateOrConnectWithoutUserInput | DocumentRecordCreateOrConnectWithoutUserInput[]
    createMany?: DocumentRecordCreateManyUserInputEnvelope
    connect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
  }

  export type UserPreferenceCreateNestedOneWithoutUserInput = {
    create?: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserPreferenceCreateOrConnectWithoutUserInput
    connect?: UserPreferenceWhereUniqueInput
  }

  export type LongTermMemoryCreateNestedManyWithoutUserInput = {
    create?: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput> | LongTermMemoryCreateWithoutUserInput[] | LongTermMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: LongTermMemoryCreateOrConnectWithoutUserInput | LongTermMemoryCreateOrConnectWithoutUserInput[]
    createMany?: LongTermMemoryCreateManyUserInputEnvelope
    connect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
  }

  export type ConversationUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput> | ConversationCreateWithoutUserInput[] | ConversationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ConversationCreateOrConnectWithoutUserInput | ConversationCreateOrConnectWithoutUserInput[]
    createMany?: ConversationCreateManyUserInputEnvelope
    connect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
  }

  export type ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput> | ResearchJobRecordCreateWithoutUserInput[] | ResearchJobRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ResearchJobRecordCreateOrConnectWithoutUserInput | ResearchJobRecordCreateOrConnectWithoutUserInput[]
    createMany?: ResearchJobRecordCreateManyUserInputEnvelope
    connect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
  }

  export type DocumentRecordUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput> | DocumentRecordCreateWithoutUserInput[] | DocumentRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DocumentRecordCreateOrConnectWithoutUserInput | DocumentRecordCreateOrConnectWithoutUserInput[]
    createMany?: DocumentRecordCreateManyUserInputEnvelope
    connect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
  }

  export type UserPreferenceUncheckedCreateNestedOneWithoutUserInput = {
    create?: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserPreferenceCreateOrConnectWithoutUserInput
    connect?: UserPreferenceWhereUniqueInput
  }

  export type LongTermMemoryUncheckedCreateNestedManyWithoutUserInput = {
    create?: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput> | LongTermMemoryCreateWithoutUserInput[] | LongTermMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: LongTermMemoryCreateOrConnectWithoutUserInput | LongTermMemoryCreateOrConnectWithoutUserInput[]
    createMany?: LongTermMemoryCreateManyUserInputEnvelope
    connect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type ConversationUpdateManyWithoutUserNestedInput = {
    create?: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput> | ConversationCreateWithoutUserInput[] | ConversationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ConversationCreateOrConnectWithoutUserInput | ConversationCreateOrConnectWithoutUserInput[]
    upsert?: ConversationUpsertWithWhereUniqueWithoutUserInput | ConversationUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ConversationCreateManyUserInputEnvelope
    set?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    disconnect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    delete?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    connect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    update?: ConversationUpdateWithWhereUniqueWithoutUserInput | ConversationUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ConversationUpdateManyWithWhereWithoutUserInput | ConversationUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ConversationScalarWhereInput | ConversationScalarWhereInput[]
  }

  export type ResearchJobRecordUpdateManyWithoutUserNestedInput = {
    create?: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput> | ResearchJobRecordCreateWithoutUserInput[] | ResearchJobRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ResearchJobRecordCreateOrConnectWithoutUserInput | ResearchJobRecordCreateOrConnectWithoutUserInput[]
    upsert?: ResearchJobRecordUpsertWithWhereUniqueWithoutUserInput | ResearchJobRecordUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ResearchJobRecordCreateManyUserInputEnvelope
    set?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    disconnect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    delete?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    connect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    update?: ResearchJobRecordUpdateWithWhereUniqueWithoutUserInput | ResearchJobRecordUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ResearchJobRecordUpdateManyWithWhereWithoutUserInput | ResearchJobRecordUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ResearchJobRecordScalarWhereInput | ResearchJobRecordScalarWhereInput[]
  }

  export type DocumentRecordUpdateManyWithoutUserNestedInput = {
    create?: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput> | DocumentRecordCreateWithoutUserInput[] | DocumentRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DocumentRecordCreateOrConnectWithoutUserInput | DocumentRecordCreateOrConnectWithoutUserInput[]
    upsert?: DocumentRecordUpsertWithWhereUniqueWithoutUserInput | DocumentRecordUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DocumentRecordCreateManyUserInputEnvelope
    set?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    disconnect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    delete?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    connect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    update?: DocumentRecordUpdateWithWhereUniqueWithoutUserInput | DocumentRecordUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DocumentRecordUpdateManyWithWhereWithoutUserInput | DocumentRecordUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DocumentRecordScalarWhereInput | DocumentRecordScalarWhereInput[]
  }

  export type UserPreferenceUpdateOneWithoutUserNestedInput = {
    create?: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserPreferenceCreateOrConnectWithoutUserInput
    upsert?: UserPreferenceUpsertWithoutUserInput
    disconnect?: UserPreferenceWhereInput | boolean
    delete?: UserPreferenceWhereInput | boolean
    connect?: UserPreferenceWhereUniqueInput
    update?: XOR<XOR<UserPreferenceUpdateToOneWithWhereWithoutUserInput, UserPreferenceUpdateWithoutUserInput>, UserPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type LongTermMemoryUpdateManyWithoutUserNestedInput = {
    create?: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput> | LongTermMemoryCreateWithoutUserInput[] | LongTermMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: LongTermMemoryCreateOrConnectWithoutUserInput | LongTermMemoryCreateOrConnectWithoutUserInput[]
    upsert?: LongTermMemoryUpsertWithWhereUniqueWithoutUserInput | LongTermMemoryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: LongTermMemoryCreateManyUserInputEnvelope
    set?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    disconnect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    delete?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    connect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    update?: LongTermMemoryUpdateWithWhereUniqueWithoutUserInput | LongTermMemoryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: LongTermMemoryUpdateManyWithWhereWithoutUserInput | LongTermMemoryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: LongTermMemoryScalarWhereInput | LongTermMemoryScalarWhereInput[]
  }

  export type ConversationUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput> | ConversationCreateWithoutUserInput[] | ConversationUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ConversationCreateOrConnectWithoutUserInput | ConversationCreateOrConnectWithoutUserInput[]
    upsert?: ConversationUpsertWithWhereUniqueWithoutUserInput | ConversationUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ConversationCreateManyUserInputEnvelope
    set?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    disconnect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    delete?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    connect?: ConversationWhereUniqueInput | ConversationWhereUniqueInput[]
    update?: ConversationUpdateWithWhereUniqueWithoutUserInput | ConversationUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ConversationUpdateManyWithWhereWithoutUserInput | ConversationUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ConversationScalarWhereInput | ConversationScalarWhereInput[]
  }

  export type ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput> | ResearchJobRecordCreateWithoutUserInput[] | ResearchJobRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: ResearchJobRecordCreateOrConnectWithoutUserInput | ResearchJobRecordCreateOrConnectWithoutUserInput[]
    upsert?: ResearchJobRecordUpsertWithWhereUniqueWithoutUserInput | ResearchJobRecordUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: ResearchJobRecordCreateManyUserInputEnvelope
    set?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    disconnect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    delete?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    connect?: ResearchJobRecordWhereUniqueInput | ResearchJobRecordWhereUniqueInput[]
    update?: ResearchJobRecordUpdateWithWhereUniqueWithoutUserInput | ResearchJobRecordUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: ResearchJobRecordUpdateManyWithWhereWithoutUserInput | ResearchJobRecordUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: ResearchJobRecordScalarWhereInput | ResearchJobRecordScalarWhereInput[]
  }

  export type DocumentRecordUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput> | DocumentRecordCreateWithoutUserInput[] | DocumentRecordUncheckedCreateWithoutUserInput[]
    connectOrCreate?: DocumentRecordCreateOrConnectWithoutUserInput | DocumentRecordCreateOrConnectWithoutUserInput[]
    upsert?: DocumentRecordUpsertWithWhereUniqueWithoutUserInput | DocumentRecordUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: DocumentRecordCreateManyUserInputEnvelope
    set?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    disconnect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    delete?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    connect?: DocumentRecordWhereUniqueInput | DocumentRecordWhereUniqueInput[]
    update?: DocumentRecordUpdateWithWhereUniqueWithoutUserInput | DocumentRecordUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: DocumentRecordUpdateManyWithWhereWithoutUserInput | DocumentRecordUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: DocumentRecordScalarWhereInput | DocumentRecordScalarWhereInput[]
  }

  export type UserPreferenceUncheckedUpdateOneWithoutUserNestedInput = {
    create?: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
    connectOrCreate?: UserPreferenceCreateOrConnectWithoutUserInput
    upsert?: UserPreferenceUpsertWithoutUserInput
    disconnect?: UserPreferenceWhereInput | boolean
    delete?: UserPreferenceWhereInput | boolean
    connect?: UserPreferenceWhereUniqueInput
    update?: XOR<XOR<UserPreferenceUpdateToOneWithWhereWithoutUserInput, UserPreferenceUpdateWithoutUserInput>, UserPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput = {
    create?: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput> | LongTermMemoryCreateWithoutUserInput[] | LongTermMemoryUncheckedCreateWithoutUserInput[]
    connectOrCreate?: LongTermMemoryCreateOrConnectWithoutUserInput | LongTermMemoryCreateOrConnectWithoutUserInput[]
    upsert?: LongTermMemoryUpsertWithWhereUniqueWithoutUserInput | LongTermMemoryUpsertWithWhereUniqueWithoutUserInput[]
    createMany?: LongTermMemoryCreateManyUserInputEnvelope
    set?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    disconnect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    delete?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    connect?: LongTermMemoryWhereUniqueInput | LongTermMemoryWhereUniqueInput[]
    update?: LongTermMemoryUpdateWithWhereUniqueWithoutUserInput | LongTermMemoryUpdateWithWhereUniqueWithoutUserInput[]
    updateMany?: LongTermMemoryUpdateManyWithWhereWithoutUserInput | LongTermMemoryUpdateManyWithWhereWithoutUserInput[]
    deleteMany?: LongTermMemoryScalarWhereInput | LongTermMemoryScalarWhereInput[]
  }

  export type UserCreateNestedOneWithoutConversationsInput = {
    create?: XOR<UserCreateWithoutConversationsInput, UserUncheckedCreateWithoutConversationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutConversationsInput
    connect?: UserWhereUniqueInput
  }

  export type MessageCreateNestedManyWithoutConversationInput = {
    create?: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput> | MessageCreateWithoutConversationInput[] | MessageUncheckedCreateWithoutConversationInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutConversationInput | MessageCreateOrConnectWithoutConversationInput[]
    createMany?: MessageCreateManyConversationInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type MessageUncheckedCreateNestedManyWithoutConversationInput = {
    create?: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput> | MessageCreateWithoutConversationInput[] | MessageUncheckedCreateWithoutConversationInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutConversationInput | MessageCreateOrConnectWithoutConversationInput[]
    createMany?: MessageCreateManyConversationInputEnvelope
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
  }

  export type UserUpdateOneRequiredWithoutConversationsNestedInput = {
    create?: XOR<UserCreateWithoutConversationsInput, UserUncheckedCreateWithoutConversationsInput>
    connectOrCreate?: UserCreateOrConnectWithoutConversationsInput
    upsert?: UserUpsertWithoutConversationsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutConversationsInput, UserUpdateWithoutConversationsInput>, UserUncheckedUpdateWithoutConversationsInput>
  }

  export type MessageUpdateManyWithoutConversationNestedInput = {
    create?: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput> | MessageCreateWithoutConversationInput[] | MessageUncheckedCreateWithoutConversationInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutConversationInput | MessageCreateOrConnectWithoutConversationInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutConversationInput | MessageUpsertWithWhereUniqueWithoutConversationInput[]
    createMany?: MessageCreateManyConversationInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutConversationInput | MessageUpdateWithWhereUniqueWithoutConversationInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutConversationInput | MessageUpdateManyWithWhereWithoutConversationInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type MessageUncheckedUpdateManyWithoutConversationNestedInput = {
    create?: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput> | MessageCreateWithoutConversationInput[] | MessageUncheckedCreateWithoutConversationInput[]
    connectOrCreate?: MessageCreateOrConnectWithoutConversationInput | MessageCreateOrConnectWithoutConversationInput[]
    upsert?: MessageUpsertWithWhereUniqueWithoutConversationInput | MessageUpsertWithWhereUniqueWithoutConversationInput[]
    createMany?: MessageCreateManyConversationInputEnvelope
    set?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    disconnect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    delete?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    connect?: MessageWhereUniqueInput | MessageWhereUniqueInput[]
    update?: MessageUpdateWithWhereUniqueWithoutConversationInput | MessageUpdateWithWhereUniqueWithoutConversationInput[]
    updateMany?: MessageUpdateManyWithWhereWithoutConversationInput | MessageUpdateManyWithWhereWithoutConversationInput[]
    deleteMany?: MessageScalarWhereInput | MessageScalarWhereInput[]
  }

  export type ConversationCreateNestedOneWithoutMessagesInput = {
    create?: XOR<ConversationCreateWithoutMessagesInput, ConversationUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: ConversationCreateOrConnectWithoutMessagesInput
    connect?: ConversationWhereUniqueInput
  }

  export type IntFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type ConversationUpdateOneRequiredWithoutMessagesNestedInput = {
    create?: XOR<ConversationCreateWithoutMessagesInput, ConversationUncheckedCreateWithoutMessagesInput>
    connectOrCreate?: ConversationCreateOrConnectWithoutMessagesInput
    upsert?: ConversationUpsertWithoutMessagesInput
    connect?: ConversationWhereUniqueInput
    update?: XOR<XOR<ConversationUpdateToOneWithWhereWithoutMessagesInput, ConversationUpdateWithoutMessagesInput>, ConversationUncheckedUpdateWithoutMessagesInput>
  }

  export type UserCreateNestedOneWithoutMemoriesInput = {
    create?: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemoriesInput
    connect?: UserWhereUniqueInput
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type UserUpdateOneRequiredWithoutMemoriesNestedInput = {
    create?: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    connectOrCreate?: UserCreateOrConnectWithoutMemoriesInput
    upsert?: UserUpsertWithoutMemoriesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutMemoriesInput, UserUpdateWithoutMemoriesInput>, UserUncheckedUpdateWithoutMemoriesInput>
  }

  export type UserCreateNestedOneWithoutResearchJobsInput = {
    create?: XOR<UserCreateWithoutResearchJobsInput, UserUncheckedCreateWithoutResearchJobsInput>
    connectOrCreate?: UserCreateOrConnectWithoutResearchJobsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutResearchJobsNestedInput = {
    create?: XOR<UserCreateWithoutResearchJobsInput, UserUncheckedCreateWithoutResearchJobsInput>
    connectOrCreate?: UserCreateOrConnectWithoutResearchJobsInput
    upsert?: UserUpsertWithoutResearchJobsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutResearchJobsInput, UserUpdateWithoutResearchJobsInput>, UserUncheckedUpdateWithoutResearchJobsInput>
  }

  export type UserCreateNestedOneWithoutDocumentsInput = {
    create?: XOR<UserCreateWithoutDocumentsInput, UserUncheckedCreateWithoutDocumentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDocumentsInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutDocumentsNestedInput = {
    create?: XOR<UserCreateWithoutDocumentsInput, UserUncheckedCreateWithoutDocumentsInput>
    connectOrCreate?: UserCreateOrConnectWithoutDocumentsInput
    upsert?: UserUpsertWithoutDocumentsInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutDocumentsInput, UserUpdateWithoutDocumentsInput>, UserUncheckedUpdateWithoutDocumentsInput>
  }

  export type UserCreateNestedOneWithoutPreferencesInput = {
    create?: XOR<UserCreateWithoutPreferencesInput, UserUncheckedCreateWithoutPreferencesInput>
    connectOrCreate?: UserCreateOrConnectWithoutPreferencesInput
    connect?: UserWhereUniqueInput
  }

  export type UserUpdateOneRequiredWithoutPreferencesNestedInput = {
    create?: XOR<UserCreateWithoutPreferencesInput, UserUncheckedCreateWithoutPreferencesInput>
    connectOrCreate?: UserCreateOrConnectWithoutPreferencesInput
    upsert?: UserUpsertWithoutPreferencesInput
    connect?: UserWhereUniqueInput
    update?: XOR<XOR<UserUpdateToOneWithWhereWithoutPreferencesInput, UserUpdateWithoutPreferencesInput>, UserUncheckedUpdateWithoutPreferencesInput>
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedIntWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedIntFilter<$PrismaModel>
    _min?: NestedIntFilter<$PrismaModel>
    _max?: NestedIntFilter<$PrismaModel>
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }
  export type NestedJsonNullableFilter<$PrismaModel = never> =
    | PatchUndefined<
        Either<Required<NestedJsonNullableFilterBase<$PrismaModel>>, Exclude<keyof Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>,
        Required<NestedJsonNullableFilterBase<$PrismaModel>>
      >
    | OptionalFlat<Omit<Required<NestedJsonNullableFilterBase<$PrismaModel>>, 'path'>>

  export type NestedJsonNullableFilterBase<$PrismaModel = never> = {
    equals?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
    path?: string[]
    mode?: QueryMode | EnumQueryModeFieldRefInput<$PrismaModel>
    string_contains?: string | StringFieldRefInput<$PrismaModel>
    string_starts_with?: string | StringFieldRefInput<$PrismaModel>
    string_ends_with?: string | StringFieldRefInput<$PrismaModel>
    array_starts_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_ends_with?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    array_contains?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | null
    lt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    lte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gt?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    gte?: InputJsonValue | JsonFieldRefInput<$PrismaModel>
    not?: InputJsonValue | JsonFieldRefInput<$PrismaModel> | JsonNullValueFilter
  }

  export type ConversationCreateWithoutUserInput = {
    id?: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageCreateNestedManyWithoutConversationInput
  }

  export type ConversationUncheckedCreateWithoutUserInput = {
    id?: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    messages?: MessageUncheckedCreateNestedManyWithoutConversationInput
  }

  export type ConversationCreateOrConnectWithoutUserInput = {
    where: ConversationWhereUniqueInput
    create: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput>
  }

  export type ConversationCreateManyUserInputEnvelope = {
    data: ConversationCreateManyUserInput | ConversationCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ResearchJobRecordCreateWithoutUserInput = {
    id?: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResearchJobRecordUncheckedCreateWithoutUserInput = {
    id?: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResearchJobRecordCreateOrConnectWithoutUserInput = {
    where: ResearchJobRecordWhereUniqueInput
    create: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput>
  }

  export type ResearchJobRecordCreateManyUserInputEnvelope = {
    data: ResearchJobRecordCreateManyUserInput | ResearchJobRecordCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type DocumentRecordCreateWithoutUserInput = {
    id?: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
  }

  export type DocumentRecordUncheckedCreateWithoutUserInput = {
    id?: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
  }

  export type DocumentRecordCreateOrConnectWithoutUserInput = {
    where: DocumentRecordWhereUniqueInput
    create: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput>
  }

  export type DocumentRecordCreateManyUserInputEnvelope = {
    data: DocumentRecordCreateManyUserInput | DocumentRecordCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type UserPreferenceCreateWithoutUserInput = {
    preferredLanguage?: string | null
    preferredDepth?: string | null
    preferredFormat?: string | null
    preferredProvider?: string | null
    timezone?: string | null
  }

  export type UserPreferenceUncheckedCreateWithoutUserInput = {
    preferredLanguage?: string | null
    preferredDepth?: string | null
    preferredFormat?: string | null
    preferredProvider?: string | null
    timezone?: string | null
  }

  export type UserPreferenceCreateOrConnectWithoutUserInput = {
    where: UserPreferenceWhereUniqueInput
    create: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
  }

  export type LongTermMemoryCreateWithoutUserInput = {
    id?: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
  }

  export type LongTermMemoryUncheckedCreateWithoutUserInput = {
    id?: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
  }

  export type LongTermMemoryCreateOrConnectWithoutUserInput = {
    where: LongTermMemoryWhereUniqueInput
    create: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput>
  }

  export type LongTermMemoryCreateManyUserInputEnvelope = {
    data: LongTermMemoryCreateManyUserInput | LongTermMemoryCreateManyUserInput[]
    skipDuplicates?: boolean
  }

  export type ConversationUpsertWithWhereUniqueWithoutUserInput = {
    where: ConversationWhereUniqueInput
    update: XOR<ConversationUpdateWithoutUserInput, ConversationUncheckedUpdateWithoutUserInput>
    create: XOR<ConversationCreateWithoutUserInput, ConversationUncheckedCreateWithoutUserInput>
  }

  export type ConversationUpdateWithWhereUniqueWithoutUserInput = {
    where: ConversationWhereUniqueInput
    data: XOR<ConversationUpdateWithoutUserInput, ConversationUncheckedUpdateWithoutUserInput>
  }

  export type ConversationUpdateManyWithWhereWithoutUserInput = {
    where: ConversationScalarWhereInput
    data: XOR<ConversationUpdateManyMutationInput, ConversationUncheckedUpdateManyWithoutUserInput>
  }

  export type ConversationScalarWhereInput = {
    AND?: ConversationScalarWhereInput | ConversationScalarWhereInput[]
    OR?: ConversationScalarWhereInput[]
    NOT?: ConversationScalarWhereInput | ConversationScalarWhereInput[]
    id?: StringFilter<"Conversation"> | string
    userId?: StringFilter<"Conversation"> | string
    title?: StringFilter<"Conversation"> | string
    createdAt?: DateTimeFilter<"Conversation"> | Date | string
    updatedAt?: DateTimeFilter<"Conversation"> | Date | string
  }

  export type ResearchJobRecordUpsertWithWhereUniqueWithoutUserInput = {
    where: ResearchJobRecordWhereUniqueInput
    update: XOR<ResearchJobRecordUpdateWithoutUserInput, ResearchJobRecordUncheckedUpdateWithoutUserInput>
    create: XOR<ResearchJobRecordCreateWithoutUserInput, ResearchJobRecordUncheckedCreateWithoutUserInput>
  }

  export type ResearchJobRecordUpdateWithWhereUniqueWithoutUserInput = {
    where: ResearchJobRecordWhereUniqueInput
    data: XOR<ResearchJobRecordUpdateWithoutUserInput, ResearchJobRecordUncheckedUpdateWithoutUserInput>
  }

  export type ResearchJobRecordUpdateManyWithWhereWithoutUserInput = {
    where: ResearchJobRecordScalarWhereInput
    data: XOR<ResearchJobRecordUpdateManyMutationInput, ResearchJobRecordUncheckedUpdateManyWithoutUserInput>
  }

  export type ResearchJobRecordScalarWhereInput = {
    AND?: ResearchJobRecordScalarWhereInput | ResearchJobRecordScalarWhereInput[]
    OR?: ResearchJobRecordScalarWhereInput[]
    NOT?: ResearchJobRecordScalarWhereInput | ResearchJobRecordScalarWhereInput[]
    id?: StringFilter<"ResearchJobRecord"> | string
    userId?: StringFilter<"ResearchJobRecord"> | string
    query?: StringFilter<"ResearchJobRecord"> | string
    plan?: JsonNullableFilter<"ResearchJobRecord">
    report?: StringNullableFilter<"ResearchJobRecord"> | string | null
    sources?: JsonNullableFilter<"ResearchJobRecord">
    stats?: JsonNullableFilter<"ResearchJobRecord">
    verificationReport?: JsonNullableFilter<"ResearchJobRecord">
    status?: StringFilter<"ResearchJobRecord"> | string
    createdAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
    updatedAt?: DateTimeFilter<"ResearchJobRecord"> | Date | string
  }

  export type DocumentRecordUpsertWithWhereUniqueWithoutUserInput = {
    where: DocumentRecordWhereUniqueInput
    update: XOR<DocumentRecordUpdateWithoutUserInput, DocumentRecordUncheckedUpdateWithoutUserInput>
    create: XOR<DocumentRecordCreateWithoutUserInput, DocumentRecordUncheckedCreateWithoutUserInput>
  }

  export type DocumentRecordUpdateWithWhereUniqueWithoutUserInput = {
    where: DocumentRecordWhereUniqueInput
    data: XOR<DocumentRecordUpdateWithoutUserInput, DocumentRecordUncheckedUpdateWithoutUserInput>
  }

  export type DocumentRecordUpdateManyWithWhereWithoutUserInput = {
    where: DocumentRecordScalarWhereInput
    data: XOR<DocumentRecordUpdateManyMutationInput, DocumentRecordUncheckedUpdateManyWithoutUserInput>
  }

  export type DocumentRecordScalarWhereInput = {
    AND?: DocumentRecordScalarWhereInput | DocumentRecordScalarWhereInput[]
    OR?: DocumentRecordScalarWhereInput[]
    NOT?: DocumentRecordScalarWhereInput | DocumentRecordScalarWhereInput[]
    id?: StringFilter<"DocumentRecord"> | string
    userId?: StringFilter<"DocumentRecord"> | string
    filename?: StringFilter<"DocumentRecord"> | string
    mimeType?: StringFilter<"DocumentRecord"> | string
    size?: IntFilter<"DocumentRecord"> | number
    text?: StringFilter<"DocumentRecord"> | string
    textLength?: IntFilter<"DocumentRecord"> | number
    createdAt?: DateTimeFilter<"DocumentRecord"> | Date | string
  }

  export type UserPreferenceUpsertWithoutUserInput = {
    update: XOR<UserPreferenceUpdateWithoutUserInput, UserPreferenceUncheckedUpdateWithoutUserInput>
    create: XOR<UserPreferenceCreateWithoutUserInput, UserPreferenceUncheckedCreateWithoutUserInput>
    where?: UserPreferenceWhereInput
  }

  export type UserPreferenceUpdateToOneWithWhereWithoutUserInput = {
    where?: UserPreferenceWhereInput
    data: XOR<UserPreferenceUpdateWithoutUserInput, UserPreferenceUncheckedUpdateWithoutUserInput>
  }

  export type UserPreferenceUpdateWithoutUserInput = {
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type UserPreferenceUncheckedUpdateWithoutUserInput = {
    preferredLanguage?: NullableStringFieldUpdateOperationsInput | string | null
    preferredDepth?: NullableStringFieldUpdateOperationsInput | string | null
    preferredFormat?: NullableStringFieldUpdateOperationsInput | string | null
    preferredProvider?: NullableStringFieldUpdateOperationsInput | string | null
    timezone?: NullableStringFieldUpdateOperationsInput | string | null
  }

  export type LongTermMemoryUpsertWithWhereUniqueWithoutUserInput = {
    where: LongTermMemoryWhereUniqueInput
    update: XOR<LongTermMemoryUpdateWithoutUserInput, LongTermMemoryUncheckedUpdateWithoutUserInput>
    create: XOR<LongTermMemoryCreateWithoutUserInput, LongTermMemoryUncheckedCreateWithoutUserInput>
  }

  export type LongTermMemoryUpdateWithWhereUniqueWithoutUserInput = {
    where: LongTermMemoryWhereUniqueInput
    data: XOR<LongTermMemoryUpdateWithoutUserInput, LongTermMemoryUncheckedUpdateWithoutUserInput>
  }

  export type LongTermMemoryUpdateManyWithWhereWithoutUserInput = {
    where: LongTermMemoryScalarWhereInput
    data: XOR<LongTermMemoryUpdateManyMutationInput, LongTermMemoryUncheckedUpdateManyWithoutUserInput>
  }

  export type LongTermMemoryScalarWhereInput = {
    AND?: LongTermMemoryScalarWhereInput | LongTermMemoryScalarWhereInput[]
    OR?: LongTermMemoryScalarWhereInput[]
    NOT?: LongTermMemoryScalarWhereInput | LongTermMemoryScalarWhereInput[]
    id?: StringFilter<"LongTermMemory"> | string
    userId?: StringFilter<"LongTermMemory"> | string
    type?: StringFilter<"LongTermMemory"> | string
    content?: StringFilter<"LongTermMemory"> | string
    confidence?: FloatFilter<"LongTermMemory"> | number
    createdAt?: DateTimeFilter<"LongTermMemory"> | Date | string
    lastAccessed?: DateTimeNullableFilter<"LongTermMemory"> | Date | string | null
    accessCount?: IntFilter<"LongTermMemory"> | number
  }

  export type UserCreateWithoutConversationsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    researchJobs?: ResearchJobRecordCreateNestedManyWithoutUserInput
    documents?: DocumentRecordCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutConversationsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    researchJobs?: ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput
    documents?: DocumentRecordUncheckedCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceUncheckedCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutConversationsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutConversationsInput, UserUncheckedCreateWithoutConversationsInput>
  }

  export type MessageCreateWithoutConversationInput = {
    id?: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
  }

  export type MessageUncheckedCreateWithoutConversationInput = {
    id?: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
  }

  export type MessageCreateOrConnectWithoutConversationInput = {
    where: MessageWhereUniqueInput
    create: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput>
  }

  export type MessageCreateManyConversationInputEnvelope = {
    data: MessageCreateManyConversationInput | MessageCreateManyConversationInput[]
    skipDuplicates?: boolean
  }

  export type UserUpsertWithoutConversationsInput = {
    update: XOR<UserUpdateWithoutConversationsInput, UserUncheckedUpdateWithoutConversationsInput>
    create: XOR<UserCreateWithoutConversationsInput, UserUncheckedCreateWithoutConversationsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutConversationsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutConversationsInput, UserUncheckedUpdateWithoutConversationsInput>
  }

  export type UserUpdateWithoutConversationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    researchJobs?: ResearchJobRecordUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutConversationsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    researchJobs?: ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUncheckedUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUncheckedUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type MessageUpsertWithWhereUniqueWithoutConversationInput = {
    where: MessageWhereUniqueInput
    update: XOR<MessageUpdateWithoutConversationInput, MessageUncheckedUpdateWithoutConversationInput>
    create: XOR<MessageCreateWithoutConversationInput, MessageUncheckedCreateWithoutConversationInput>
  }

  export type MessageUpdateWithWhereUniqueWithoutConversationInput = {
    where: MessageWhereUniqueInput
    data: XOR<MessageUpdateWithoutConversationInput, MessageUncheckedUpdateWithoutConversationInput>
  }

  export type MessageUpdateManyWithWhereWithoutConversationInput = {
    where: MessageScalarWhereInput
    data: XOR<MessageUpdateManyMutationInput, MessageUncheckedUpdateManyWithoutConversationInput>
  }

  export type MessageScalarWhereInput = {
    AND?: MessageScalarWhereInput | MessageScalarWhereInput[]
    OR?: MessageScalarWhereInput[]
    NOT?: MessageScalarWhereInput | MessageScalarWhereInput[]
    id?: StringFilter<"Message"> | string
    conversationId?: StringFilter<"Message"> | string
    role?: StringFilter<"Message"> | string
    content?: StringFilter<"Message"> | string
    tokensUsed?: IntFilter<"Message"> | number
    modelUsed?: StringNullableFilter<"Message"> | string | null
    createdAt?: DateTimeFilter<"Message"> | Date | string
  }

  export type ConversationCreateWithoutMessagesInput = {
    id?: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
    user: UserCreateNestedOneWithoutConversationsInput
  }

  export type ConversationUncheckedCreateWithoutMessagesInput = {
    id?: string
    userId: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ConversationCreateOrConnectWithoutMessagesInput = {
    where: ConversationWhereUniqueInput
    create: XOR<ConversationCreateWithoutMessagesInput, ConversationUncheckedCreateWithoutMessagesInput>
  }

  export type ConversationUpsertWithoutMessagesInput = {
    update: XOR<ConversationUpdateWithoutMessagesInput, ConversationUncheckedUpdateWithoutMessagesInput>
    create: XOR<ConversationCreateWithoutMessagesInput, ConversationUncheckedCreateWithoutMessagesInput>
    where?: ConversationWhereInput
  }

  export type ConversationUpdateToOneWithWhereWithoutMessagesInput = {
    where?: ConversationWhereInput
    data: XOR<ConversationUpdateWithoutMessagesInput, ConversationUncheckedUpdateWithoutMessagesInput>
  }

  export type ConversationUpdateWithoutMessagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    user?: UserUpdateOneRequiredWithoutConversationsNestedInput
  }

  export type ConversationUncheckedUpdateWithoutMessagesInput = {
    id?: StringFieldUpdateOperationsInput | string
    userId?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type UserCreateWithoutMemoriesInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordCreateNestedManyWithoutUserInput
    documents?: DocumentRecordCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceCreateNestedOneWithoutUserInput
  }

  export type UserUncheckedCreateWithoutMemoriesInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationUncheckedCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput
    documents?: DocumentRecordUncheckedCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceUncheckedCreateNestedOneWithoutUserInput
  }

  export type UserCreateOrConnectWithoutMemoriesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
  }

  export type UserUpsertWithoutMemoriesInput = {
    update: XOR<UserUpdateWithoutMemoriesInput, UserUncheckedUpdateWithoutMemoriesInput>
    create: XOR<UserCreateWithoutMemoriesInput, UserUncheckedCreateWithoutMemoriesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutMemoriesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutMemoriesInput, UserUncheckedUpdateWithoutMemoriesInput>
  }

  export type UserUpdateWithoutMemoriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUpdateOneWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutMemoriesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUncheckedUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUncheckedUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUncheckedUpdateOneWithoutUserNestedInput
  }

  export type UserCreateWithoutResearchJobsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationCreateNestedManyWithoutUserInput
    documents?: DocumentRecordCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutResearchJobsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationUncheckedCreateNestedManyWithoutUserInput
    documents?: DocumentRecordUncheckedCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceUncheckedCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutResearchJobsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutResearchJobsInput, UserUncheckedCreateWithoutResearchJobsInput>
  }

  export type UserUpsertWithoutResearchJobsInput = {
    update: XOR<UserUpdateWithoutResearchJobsInput, UserUncheckedUpdateWithoutResearchJobsInput>
    create: XOR<UserCreateWithoutResearchJobsInput, UserUncheckedCreateWithoutResearchJobsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutResearchJobsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutResearchJobsInput, UserUncheckedUpdateWithoutResearchJobsInput>
  }

  export type UserUpdateWithoutResearchJobsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutResearchJobsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUncheckedUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUncheckedUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUncheckedUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutDocumentsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutDocumentsInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationUncheckedCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput
    preferences?: UserPreferenceUncheckedCreateNestedOneWithoutUserInput
    memories?: LongTermMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutDocumentsInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutDocumentsInput, UserUncheckedCreateWithoutDocumentsInput>
  }

  export type UserUpsertWithoutDocumentsInput = {
    update: XOR<UserUpdateWithoutDocumentsInput, UserUncheckedUpdateWithoutDocumentsInput>
    create: XOR<UserCreateWithoutDocumentsInput, UserUncheckedCreateWithoutDocumentsInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutDocumentsInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutDocumentsInput, UserUncheckedUpdateWithoutDocumentsInput>
  }

  export type UserUpdateWithoutDocumentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutDocumentsInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUncheckedUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput
    preferences?: UserPreferenceUncheckedUpdateOneWithoutUserNestedInput
    memories?: LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type UserCreateWithoutPreferencesInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordCreateNestedManyWithoutUserInput
    documents?: DocumentRecordCreateNestedManyWithoutUserInput
    memories?: LongTermMemoryCreateNestedManyWithoutUserInput
  }

  export type UserUncheckedCreateWithoutPreferencesInput = {
    id?: string
    email?: string | null
    name?: string | null
    passwordHash?: string | null
    createdAt?: Date | string
    updatedAt?: Date | string
    conversations?: ConversationUncheckedCreateNestedManyWithoutUserInput
    researchJobs?: ResearchJobRecordUncheckedCreateNestedManyWithoutUserInput
    documents?: DocumentRecordUncheckedCreateNestedManyWithoutUserInput
    memories?: LongTermMemoryUncheckedCreateNestedManyWithoutUserInput
  }

  export type UserCreateOrConnectWithoutPreferencesInput = {
    where: UserWhereUniqueInput
    create: XOR<UserCreateWithoutPreferencesInput, UserUncheckedCreateWithoutPreferencesInput>
  }

  export type UserUpsertWithoutPreferencesInput = {
    update: XOR<UserUpdateWithoutPreferencesInput, UserUncheckedUpdateWithoutPreferencesInput>
    create: XOR<UserCreateWithoutPreferencesInput, UserUncheckedCreateWithoutPreferencesInput>
    where?: UserWhereInput
  }

  export type UserUpdateToOneWithWhereWithoutPreferencesInput = {
    where?: UserWhereInput
    data: XOR<UserUpdateWithoutPreferencesInput, UserUncheckedUpdateWithoutPreferencesInput>
  }

  export type UserUpdateWithoutPreferencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUpdateManyWithoutUserNestedInput
    memories?: LongTermMemoryUpdateManyWithoutUserNestedInput
  }

  export type UserUncheckedUpdateWithoutPreferencesInput = {
    id?: StringFieldUpdateOperationsInput | string
    email?: NullableStringFieldUpdateOperationsInput | string | null
    name?: NullableStringFieldUpdateOperationsInput | string | null
    passwordHash?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    conversations?: ConversationUncheckedUpdateManyWithoutUserNestedInput
    researchJobs?: ResearchJobRecordUncheckedUpdateManyWithoutUserNestedInput
    documents?: DocumentRecordUncheckedUpdateManyWithoutUserNestedInput
    memories?: LongTermMemoryUncheckedUpdateManyWithoutUserNestedInput
  }

  export type ConversationCreateManyUserInput = {
    id?: string
    title?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type ResearchJobRecordCreateManyUserInput = {
    id?: string
    query: string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: string
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type DocumentRecordCreateManyUserInput = {
    id?: string
    filename: string
    mimeType: string
    size: number
    text: string
    textLength: number
    createdAt?: Date | string
  }

  export type LongTermMemoryCreateManyUserInput = {
    id?: string
    type: string
    content: string
    confidence?: number
    createdAt?: Date | string
    lastAccessed?: Date | string | null
    accessCount?: number
  }

  export type ConversationUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUpdateManyWithoutConversationNestedInput
  }

  export type ConversationUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    messages?: MessageUncheckedUpdateManyWithoutConversationNestedInput
  }

  export type ConversationUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    title?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResearchJobRecordUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResearchJobRecordUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type ResearchJobRecordUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    query?: StringFieldUpdateOperationsInput | string
    plan?: NullableJsonNullValueInput | InputJsonValue
    report?: NullableStringFieldUpdateOperationsInput | string | null
    sources?: NullableJsonNullValueInput | InputJsonValue
    stats?: NullableJsonNullValueInput | InputJsonValue
    verificationReport?: NullableJsonNullValueInput | InputJsonValue
    status?: StringFieldUpdateOperationsInput | string
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type DocumentRecordUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    filename?: StringFieldUpdateOperationsInput | string
    mimeType?: StringFieldUpdateOperationsInput | string
    size?: IntFieldUpdateOperationsInput | number
    text?: StringFieldUpdateOperationsInput | string
    textLength?: IntFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type LongTermMemoryUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type LongTermMemoryUncheckedUpdateWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type LongTermMemoryUncheckedUpdateManyWithoutUserInput = {
    id?: StringFieldUpdateOperationsInput | string
    type?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    confidence?: FloatFieldUpdateOperationsInput | number
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    lastAccessed?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    accessCount?: IntFieldUpdateOperationsInput | number
  }

  export type MessageCreateManyConversationInput = {
    id?: string
    role: string
    content: string
    tokensUsed?: number
    modelUsed?: string | null
    createdAt?: Date | string
  }

  export type MessageUpdateWithoutConversationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateWithoutConversationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type MessageUncheckedUpdateManyWithoutConversationInput = {
    id?: StringFieldUpdateOperationsInput | string
    role?: StringFieldUpdateOperationsInput | string
    content?: StringFieldUpdateOperationsInput | string
    tokensUsed?: IntFieldUpdateOperationsInput | number
    modelUsed?: NullableStringFieldUpdateOperationsInput | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}