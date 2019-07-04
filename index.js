import { ApolloServer, gql, ApolloError } from 'apollo-server';
import { GraphQLScalarType } from 'graphql';
import { Kind } from 'graphql/language';

import chalk from 'chalk';
const cyan = chalk.bold.cyan;
const red = chalk.bold.red;
const yellow = chalk.bold.yellow;

import mongoose from 'mongoose';

mongoose.Promise = global.Promise;
mongoose.set('useFindAndModify', false);

const Schema = mongoose.Schema;

const todoSchema = new Schema({
  description: String,
  createdAt: Date,
  completed: Boolean,
  priority: Number,
});

const Todo = mongoose.model('Todo', todoSchema);

const typeDefs = gql`
  """
  Custom scalar data type representing date
  """
  scalar Date

  """
  Data type representing the task itself.

  **_id**: required. Todo's ID, generated by a server.

  **description**: required. Todo itself.

  **createdAt**: when todo was created. By default - current datetime.

  **completed**: indicates whether the todo is completed or not. By default - false.

  **priority**: indicates the priority of the todo. By default - 1, highest.
  """
  type Todo {
    _id: String!
    description: String!
    createdAt: Date
    completed: Boolean
    priority: Int
  }

  type Query {
    """
    This is a query that returns todos. Without any arguments will return unsorted list of all todos.

    **sortBy**: field by which you want to sort todos (description, createdAt, completed, priority)

    **order**: sort order (ASC or DESC). Default is ASC

    **completed**: if this parametr is **true** then only completed todos will be in result set and not completed, if parametr is **false**.
    By default completed and uncompleted todos will be in result.
    """
    todosList(sortBy: String, order: String, completed: Boolean): [Todo]
  }

  type Mutation {
    """
    Mutation to create a todo. Will return newly created Todo.

    **description**: required. Todo itself.

    **createdAt**: when todo was created. By default - current datetime.

    **completed**: indicates whether the todo is completed or not. By default - false.

    **priority**: indicates the priority of the todo. By default - 1, highest.
    """
    create(description: String!, createdAt: Date, completed: Boolean, priority: Int): Todo
    """
    Mutation to delete a todo. Will return **true** if the deletion was successful.

    **id**: required. Todo's id, which one you want to delete.
    """
    delete(id: String!): Boolean
    """
    Mutation to update a todo. Will return todo with changes.

    **id**: required. Todo's id, which one you want to update.

    **description**: required. New description.

    **priority**: indicates the priority of the todo. By default - 1, highest.
    """
    update(id: String!, description: String!, priority: Int): Todo

    """
    Mutation to make a todo completed. Will return todo with changes.

    **id**: required. Todo's id, which one you want to mark as completed.
    """
    complete(id: String!): Todo
  }
`;

const resolvers = {
  Query: {
    todosList: async (_, { sortBy, order = 'ASC', completed = null }) => {
      const filter = completed !== null ? { completed: completed } : {};
      const sort = sortBy && {
        sort: {
          [sortBy]: order,
        },
      };
      try {
        return await Todo.find(filter, null, sort);
      } catch (e) {
        throw new ApolloError(e.message);
      }
    },
  },
  Mutation: {
    create: async (_, { description, createdAt = new Date(), completed = false, priority = 1 }) => {
      try {
        return await new Todo({ description, createdAt, completed, priority }).save();
      } catch (e) {
        throw new ApolloError(e.message);
      }
    },
    delete: async (_, { id }) => {
      try {
        const success = await Todo.deleteOne({ _id: id });
        return Boolean(success.deletedCount);
      } catch (e) {
        throw new ApolloError(e.message);
      }
    },
    update: async (_, { id, description, priority = 1 }) => {
      const validPriority = priority > 0 ? priority : 1;
      try {
        return await Todo.findOneAndUpdate({ _id: id }, { description, priority: validPriority }, { new: true });
      } catch (e) {
        throw new ApolloError(e.message);
      }
    },
    complete: async (_, { id }) => {
      try {
        return await Todo.findOneAndUpdate({ _id: id }, { completed: true }, { new: true });
      } catch (e) {
        throw new ApolloError(e.message);
      }
    },
  },
  Date: new GraphQLScalarType({
    name: 'Date',
    description: 'Date custom scalar type',
    parseValue(value) {
      return new Date(value);
    },
    serialize(value) {
      return value.getTime();
    },
    parseLiteral(ast) {
      if (ast.kind === Kind.INT) {
        return new Date(ast.value);
      }
      return null;
    },
  }),
};

const connectionURL = 'mongodb://localhost/todo';

mongoose.connection.on('connected', () => {
  console.log(cyan(`Connected to ${connectionURL}`));
  new ApolloServer({ typeDefs, resolvers }).listen().then(({ url }) => {
    console.log(cyan(`Server ready at ${url}`));
  });
});

mongoose.connection.on('error', err => {
  console.log(red(`Mongoose connection has occured ${err} error`));
});

mongoose.connection.on('disconnected', () => {
  console.log(red('Mongoose is disconnected'));
});

try {
  mongoose.connect(connectionURL, { useNewUrlParser: true });
} catch (e) {
  console.log(red(`Sever connection failed ${e.message}`));
}

process.on('SIGINT', () => {
  mongoose.connection.close(() => {
    console.log(yellow('Mongoose is disconnected due to application termination'));
    process.exit(0);
  });
});
