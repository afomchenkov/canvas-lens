export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type WorkerOutgoingMessage = {
  type: "backgroundRendered" | "colorChanged";
  hexColor?: string;
};