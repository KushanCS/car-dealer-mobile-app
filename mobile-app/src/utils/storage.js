import AsyncStorage from "@react-native-async-storage/async-storage";

const memoryStorage = new Map();
let canUseNativeStorage = true;

const isNativeStorageUnavailable = (error) =>
  String(error?.message || error).includes("Native module is null");

export const saveUser = async (userData) => {
  try {
    if (!canUseNativeStorage) {
      memoryStorage.set("user", JSON.stringify(userData));
      return;
    }

    await AsyncStorage.setItem("user", JSON.stringify(userData));
  } catch (error) {
    if (isNativeStorageUnavailable(error)) {
      canUseNativeStorage = false;
      memoryStorage.set("user", JSON.stringify(userData));
      console.log(
        "AsyncStorage native module unavailable. Falling back to in-memory session storage."
      );
      return;
    }

    console.log("Error saving user:", error);
  }
};

export const getUser = async () => {
  try {
    if (!canUseNativeStorage) {
      const user = memoryStorage.get("user");
      return user ? JSON.parse(user) : null;
    }

    const user = await AsyncStorage.getItem("user");
    return user ? JSON.parse(user) : null;
  } catch (error) {
    if (isNativeStorageUnavailable(error)) {
      canUseNativeStorage = false;
      const user = memoryStorage.get("user");
      console.log(
        "AsyncStorage native module unavailable. Falling back to in-memory session storage."
      );
      return user ? JSON.parse(user) : null;
    }

    console.log("Error getting user:", error);
    return null;
  }
};

export const removeUser = async () => {
  try {
    if (!canUseNativeStorage) {
      memoryStorage.delete("user");
      return;
    }

    await AsyncStorage.removeItem("user");
  } catch (error) {
    if (isNativeStorageUnavailable(error)) {
      canUseNativeStorage = false;
      memoryStorage.delete("user");
      console.log(
        "AsyncStorage native module unavailable. Falling back to in-memory session storage."
      );
      return;
    }

    console.log("Error removing user:", error);
  }
};
