// Simple in-memory store (Not suitable for production scaling)

const taskDataStore = new Map();

export const storeTaskData = (taskId, data) => {
  console.log(`[Store] Storing data for task: ${taskId}`);
  taskDataStore.set(taskId, data);
};

export const retrieveTaskData = (taskId) => {
  console.log(`[Store] Retrieving data for task: ${taskId}`);
  return taskDataStore.get(taskId);
};

export const removeTaskData = (taskId) => {
  console.log(`[Store] Removing data for task: ${taskId}`);
  taskDataStore.delete(taskId);
}; 