import logo from './logo.svg';
import './App.css';
import axios from 'axios';
import { useEffect } from 'react';
function App() {
  useEffect(() => {
    axios.get('http://localhost:5000/')
      .then(response => {
        console.log(response.data);
      })
      .catch(error => {
        console.error('There was an error!', error);
      });
  }, []);

  return (
    <div className="App">
      <header className="App-header">
        <h1>AI Food & Fitness Tracker</h1>
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
      </header>
    </div>
    
  );
}

export default App;
