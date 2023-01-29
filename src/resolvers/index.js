const path = require("path");
const fsPromises = require("fs/promises");
const { GraphQLError } = require("graphql");
const {
  fileExists,
  readJsonFile,
  getDirectoryFileNames,
  deleteFile,
} = require("../utils/fileHandling");
const crypto = require("crypto");
const axios = require("axios").default;

const productsDirectory = path.join(__dirname, "..", "data", "products");
const cartsDirectory = path.join(__dirname, "..", "data", "carts");

exports.resolvers = {
  Query: {
    getCart: async (_, args) => {
      const cartId = args.cartId;
      const cartFilePath = path.join(cartsDirectory, `${cartId}.json`);

      const cartExists = await fileExists(cartFilePath);
      if (!cartExists) return new GraphQLError("We cannot find your cart");

      const cartData = await fsPromises.readFile(cartFilePath, {
        encoding: "utf-8",
      });

      const data = JSON.parse(cartData);
      return data;
    },
    getProduct: async (_, args) => {
      const productId = args.productId;
      const productFilePath = path.join(productsDirectory, `${productId}.json`);

      const productExists = await fileExists(productFilePath);
      if (!productExists) return new GraphQLError("cannot find that product");

      const productData = await fsPromises.readFile(productFilePath, {
        encoding: "utf-8",
      });

      const data = JSON.parse(productData);
      return data;
    },
    getAllProducts: async (_, args) => {
      const products = await getDirectoryFileNames(productsDirectory);

      const productData = [];

      for (const file of products) {
        const filePath = path.join(productsDirectory, file);
        const fileContents = await fsPromises.readFile(filePath, {
          encoding: "utf-8",
        });
        const data = JSON.parse(fileContents);
        productData.push(data);
      }
      return productData;
    },
  },
  Mutation: {
    createCart: async (_, args) => {
      const newCart = {
        id: crypto.randomUUID(),
        items: [],
        totalSum: 0,
      };

      let filePath = path.join(cartsDirectory, `${newCart.id}.json`);

      let idExists = true;
      while (idExists) {
        const exists = await fileExists(filePath);
        if (exists) {
          newCart.id = crypto.randomUUID();
          filePath = path.join(cartsDirectory, `${newCart.id}.json`);
        }
        idExists = exists;
      }

      await fsPromises.writeFile(filePath, JSON.stringify(newCart));
      return newCart;
    },
    addProductToCart: async (_, args) => {
      const { cartId, productId } = args;

      const cartFilePath = path.join(cartsDirectory, `${cartId}.json`);
      const cartExists = await fileExists(cartFilePath);
      if (!cartExists) return new GraphQLError("cannot find cart");

      const data = await readJsonFile(cartFilePath);

      let productInCartExist = false;
      for (let x of data.items) {
        if (x.id === productId) {
          x.quantity++;
          productInCartExist = true;
        }
      }

      if (!productInCartExist) {
        const productFilePath = path.join(
          productsDirectory,
          `${productId}.json`
        );
        const productExists = await fileExists(productFilePath);

        if (!productExists)
          return new GraphQLError(
            "that specific product does not exist in cart"
          );

        const productData = await readJsonFile(productFilePath);

        const newCartItem = {
          id: productData.id,
          name: productData.name,
          quantity: 1,
          price: productData.price,
        };

        data.items.push(newCartItem);
      }

      let sum = 0;
      for (let x of data.items) {
        sum += x.quantity * x.price;
      }

      data.totalSum = sum;

      await fsPromises.writeFile(cartFilePath, JSON.stringify(data));

      return data;
    },
    deletedCart: async (_, args) => {
      const cartId = args.cartId;

      let filePath = path.join(cartsDirectory, `${cartId}.json`);
      const cartExists = await fileExists(filePath);
      if (!cartExists) return new GraphQLError("cannot find cart");

      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: cartId,
          success: false,
        };
      }
      return {
        deletedId: cartId,
        success: true,
      };
    },

    deleteProduct: async (_, args) => {
      const productId = args.productId;

      let filePath = path.join(productsDirectory, `${productId}.json`);
      const productExists = await fileExists(filePath);
      if (!productExists) return new GraphQLError("cannot find product");

      try {
        await deleteFile(filePath);
      } catch (error) {
        return {
          deletedId: productId,
          success: false,
        };
      }
      return {
        deletedId: productId,
        success: true,
      };
    },

    deleteProductFromCart: async (_, args) => {
      const { cartId, cartItemId } = args;

      const cartFilePath = path.join(cartsDirectory, `${cartId}.json`);
      const cartExists = await fileExists(cartFilePath);
      if (!cartExists) return new GraphQLError("cannot find cart");

      const data = await readJsonFile(cartFilePath);

      let productInCartExists = false;

      for (let i = 0; i < data.items.length; i++) {
        if (data.items[i].id == cartItemId) {
          data.items[i].quantity--;
          productInCartExists = true;
          if (data.items[i].quantity === 0) {
            console.log(data.items[i].quantity);
            data.items.splice(i, 1);
          }
        }
      }

      if (!productInCartExists) {
        return new GraphQLError("that product does not exists in your cart");
      }

      let sum = 0;

      for (let x of data.items) {
        sum += x.quantity * x.price;
      }

      data.totalSum = sum;

      await fsPromises.writeFile(cartFilePath, JSON.stringify(data));
      return data;
    },
  },
};
