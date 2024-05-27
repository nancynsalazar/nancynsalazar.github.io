/*Movimiento en palabras, intento 1*/
/*/
document.addEventListener("DOMContentLoaded", function() {
    const words = document.querySelectorAll('.cd-words-wrapper b');
    let currentWord = 0;
  
    setInterval(function() {
      words[currentWord].classList.remove('is-visible');
      currentWord = (currentWord + 1) % words.length;
      words[currentWord].classList.add('is-visible');
    }, 4655.5); // Cambia 4000 (4 segundos) por el tiempo que desees entre transiciones
  });
  */


  document.addEventListener("DOMContentLoaded", function() {
    const words = document.querySelectorAll('.cd-words-wrapper b');
    let currentWord = 0;

    setInterval(function() {
        words[currentWord].classList.remove('is-visible');
        words[currentWord].classList.add('is-hidden');

        currentWord = (currentWord + 1) % words.length;

        words[currentWord].classList.remove('is-hidden');
        words[currentWord].classList.add('is-visible');
    }, 4000); // Cambia el intervalo según la rapidez con la que quieras que cambien las palabras
});

