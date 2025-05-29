
export const calculateEstimatedPrice = (mileage: number): number => {
  // Base fare + per mile rate
  const baseFare = 2.50; // $2.50 base fare
  const perMileRate = 1.75; // $1.75 per mile
  
  return baseFare + (mileage * perMileRate);
};

export const formatPrice = (price: number): string => {
  return `$${price.toFixed(2)}`;
};
