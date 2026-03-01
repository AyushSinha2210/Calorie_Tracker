/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    50: '#f5f6ff',
                    100: '#ebedff',
                    200: '#ccd2ff',
                    300: '#a3aeff',
                    400: '#7383ff',
                    500: '#667eea', // primary
                    600: '#4d61c7',
                    700: '#3c4ba3',
                    800: '#2f3b82',
                    900: '#283269',
                },
                accent: {
                    50: '#fcf8ff',
                    100: '#f6ecff',
                    200: '#ead1ff',
                    300: '#d7aaff',
                    400: '#c07dff',
                    500: '#764ba2', // gradient secondary
                    600: '#8b3dcc',
                    700: '#722ba8',
                    800: '#5e258a',
                    900: '#4e2370',
                }
            }
        },
    },
    plugins: [],
}
