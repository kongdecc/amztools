const config = {
  plugins: {
    "postcss-preset-env": {
      stage: 0,
      features: {
        "cascade-layers": true,
        "oklch-function": true,
        "color-function": true,
      },
      browsers: "Android >= 4.4, iOS >= 10",
    },
    "@tailwindcss/postcss": {},
  },
};

export default config;
