// ═══ CONFIGURACIÓN ═══
// Configuración de las variables de entorno
let API_KEY = "";
let API_SECRET = "";
const ITEMS_LIMIT = 12;

// ═══ CARGA DE ENTORNO ═══
/**
 * Carga y parsea el archivo .env local
 */
async function loadEnv() {
  try {
    const response = await fetch(".env");
    if (!response.ok) throw new Error("No se encontró el archivo .env");
    const text = await response.text();
    
    // Parseo básico de cada línea del archivo .env
    text.split('\n').forEach(line => {
      // Ignorar líneas vacías o comentarios
      if (!line.trim() || line.trim().startsWith('#')) return;
      
      const [key, ...values] = line.split('=');
      if (key && values.length > 0) {
        // Unir el valor por si contiene signos '=' y remover comillas extras
        const value = values.join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key.trim() === 'API_KEY') API_KEY = value;
        if (key.trim() === 'API_SECRET') API_SECRET = value;
      }
    });
  } catch (error) {
    console.error("Error cargando .env:", error);
  }
}

// ═══ CACHÉ ═══
// Objeto global de caché en memoria persistente solo por sesión (hasta recargar la página)
const cache = {};

// ═══ LLAMADAS A LA API ═══
/**
 * Realiza la petición fetch con control de errores y utiliza la caché.
 * @param {string} url La URL de la API a consumir
 * @returns {Promise<Object>} Datos JSON devueltos por la API o arroja un error
 */
async function fetchAPI(url) {
  if (cache[url]) {
    console.log("Servido desde memoria caché:", url);
    return cache[url];
  }

  try {
    const response = await fetch(url);

    if (!response.ok) {
      if (response.status === 401)
        throw new Error("API Key inválida o no configurada.");
      if (response.status === 429)
        throw new Error(
          "Límite de peticiones alcanzado. Intenta en unos minutos.",
        );
      throw new Error(`Error en la petición: HTTP ${response.status}`);
    }

    const data = await response.json();
    cache[url] = data;
    return data;
  } catch (error) {
    if (error.name === "TypeError") {
      throw new Error("Error de conexión. Verifica tu internet o la URL.");
    }
    throw error;
  }
}

// ═══ RENDERIZADO ═══
const mainContent = document.getElementById("content");

function showLoader() {
  mainContent.innerHTML = `
        <div class="loader-container">
            <div class="spinner"></div>
        </div>
    `;
}

function showError(msg) {
  mainContent.innerHTML = `
        <div class="error-msg">
            <strong>¡Ocurrió un error!</strong><br><br>
            ${msg}
        </div>
    `;
}

function formatDate(dateString) {
  if (!dateString) return "";
  const options = { year: "numeric", month: "long", day: "numeric" };
  const date = new Date(dateString);
  return isNaN(date.getTime())
    ? dateString
    : date.toLocaleDateString("es-ES", options);
}

function renderBookCard(book) {
  const imgHtml = book.book_image
    ? `<img src="${book.book_image}" alt="Portada de ${book.title}" class="card-img" loading="lazy">`
    : `<div class="card-img">📖</div>`;

  return `
        <article class="card">
            ${book.rank ? `<div class="card-rank">#${book.rank}</div>` : ""}
            ${imgHtml}
            <div class="card-content">
                <div class="card-category">LIBRO</div>
                <h3 class="card-title">${book.title || "Sin Título"}</h3>
                <div class="card-meta">
                    <span><strong>Autor:</strong> ${book.author || "Desconocido"}</span>
                    <span><strong>Editorial:</strong> ${book.publisher || "N/A"}</span>
                    ${book.weeks_on_list ? `<span><strong>Semanas listado:</strong> ${book.weeks_on_list}</span>` : ""}
                </div>
                <p class="card-desc">${book.description || "Sin descripción disponible para este título."}</p>
                <a href="${book.amazon_product_url || "#"}" target="_blank" rel="noopener noreferrer" class="card-btn">Ver en Amazon</a>
            </div>
        </article>
    `;
}

function renderArticleCard(article, imgUrl) {
  const imgHtml = imgUrl
    ? `<img src="${imgUrl}" alt="Imagen del artículo" class="card-img" loading="lazy">`
    : `<div class="card-img">📰</div>`;

  const byline = article.byline
    ? article.byline.replace(/^By /i, "")
    : "Redacción NYT";

  return `
        <article class="card">
            ${imgHtml}
            <div class="card-content">
                <div class="card-category">${article.section || "Noticias"}</div>
                <h3 class="card-title">${article.title || "Titular de NYT"}</h3>
                <div class="card-meta">
                    <span><strong>Autor:</strong> ${byline}</span>
                    <span><strong>Fecha:</strong> ${formatDate(article.published_date)}</span>
                </div>
                <p class="card-desc">${article.abstract || "Resumen no disponible para este artículo."}</p>
                <a href="${article.url || "#"}" target="_blank" rel="noopener noreferrer" class="card-btn">Leer artículo</a>
            </div>
        </article>
    `;
}

function renderGrid(title, cardsHtml, controlsHtml = "") {
  if (!cardsHtml || cardsHtml.length === 0) {
    showError(
      "No se encontraron resultados para esta consulta en el servidor.",
    );
    return;
  }

  mainContent.innerHTML = `
        <h2 class="section-title">${title}</h2>
        ${controlsHtml ? `<div class="controls">${controlsHtml}</div>` : ""}
        <div class="grid">
            ${cardsHtml.join("")}
        </div>
    `;
}

// ═══ NAVEGACIÓN ═══
let currentSectionType = "books";
let currentSubSection = "overview";
let currentPeriod = 1;
let currentSearchTerm = "";

async function loadCategory(type, subsection) {
  if (type) currentSectionType = type;
  if (subsection) currentSubSection = subsection;
  currentSearchTerm = ""; // Reset search term when changing categories

  showLoader();

  try {
    let url = "";
    let title = "";
    let cardsHtml = [];
    let controlsHtml = "";

    if (currentSectionType === "books") {
      controlsHtml = `
          <div class="search-bar" style="margin-bottom: 1.5rem; display: flex; gap: 0.5rem; width: 100%; max-width: 500px;">
              <input type="text" id="book-search" placeholder="Buscar por título, autor o editorial..." 
                     style="flex-grow: 1; padding: 0.8rem; background-color: var(--card-bg); color: var(--text-color); border: 1px solid var(--border-color); border-radius: 4px; font-family: var(--font-body); outline: none;"
                     onkeyup="if(event.key === 'Enter') executeBookSearch()">
              <button onclick="executeBookSearch()" style="padding: 0.8rem 1.5rem; background-color: var(--accent-color); color: white; border: none; border-radius: 4px; cursor: pointer; font-family: var(--font-title); font-weight: bold; transition: background-color 0.2s;">Buscar</button>
          </div>
      `;

      if (currentSubSection === "overview") {
        title = "Libros: Overview Semanal";
        url = `https://api.nytimes.com/svc/books/v3/lists/overview.json?api-key=${API_KEY}`;
        const data = await fetchAPI(url);

        let itemsCount = 0;
        if (data.results && data.results.lists) {
          for (const list of data.results.lists) {
            for (const book of list.books) {
              // Aplicar filtro de búsqueda
              if (currentSearchTerm) {
                  const t = currentSearchTerm.toLowerCase();
                  const matches = (book.title && book.title.toLowerCase().includes(t)) ||
                                  (book.author && book.author.toLowerCase().includes(t)) ||
                                  (book.publisher && book.publisher.toLowerCase().includes(t));
                  if (!matches) continue;
              }

              if (itemsCount >= ITEMS_LIMIT) break;
              cardsHtml.push(renderBookCard(book));
              itemsCount++;
            }
            if (itemsCount >= ITEMS_LIMIT) break;
          }
        }
      } else {
        const secLabel =
          currentSubSection === "hardcover-fiction" ? "Ficción" : "No Ficción";
        title = `Libros: ${secLabel} (Top 15)`;
        url = `https://api.nytimes.com/svc/books/v3/lists/current/${currentSubSection}.json?api-key=${API_KEY}`;
        const data = await fetchAPI(url);

        const books = data.results?.books || [];
        
        // Aplicar filtro de búsqueda
        const filteredBooks = currentSearchTerm 
            ? books.filter(book => {
                const t = currentSearchTerm.toLowerCase();
                return (book.title && book.title.toLowerCase().includes(t)) ||
                       (book.author && book.author.toLowerCase().includes(t)) ||
                       (book.publisher && book.publisher.toLowerCase().includes(t));
              })
            : books;

        const limitedBooks = filteredBooks.slice(0, ITEMS_LIMIT);
        cardsHtml = limitedBooks.map(renderBookCard);
      }
    } else if (currentSectionType === "most-popular") {
      const typeLabel =
        currentSubSection === "viewed" ? "Más Vistos" : "Más Compartidos";
      title = `Lo Más Popular: ${typeLabel}`;

      controlsHtml = `
                <label for="period-select" style="font-weight:bold; font-family:var(--font-title);">Mostrar popularidad del periodo:</label>
                <select id="period-select" onchange="changePeriod(this.value)">
                    <option value="1" ${currentPeriod == 1 ? "selected" : ""}>Último día (1 día)</option>
                    <option value="7" ${currentPeriod == 7 ? "selected" : ""}>Última semana (7 días)</option>
                    <option value="30" ${currentPeriod == 30 ? "selected" : ""}>Último mes (30 días)</option>
                </select>
            `;

      url = `https://api.nytimes.com/svc/mostpopular/v2/${currentSubSection}/${currentPeriod}.json?api-key=${API_KEY}`;
      const data = await fetchAPI(url);

      const articles = data.results || [];
      const limitedArticles = articles.slice(0, ITEMS_LIMIT);

      cardsHtml = limitedArticles.map((article) => {
        let imgUrl = null;
        if (article.media && article.media.length > 0) {
          const metadata = article.media[0]["media-metadata"];
          if (metadata && metadata.length >= 3) {
            imgUrl = metadata[2].url;
          } else if (metadata && metadata.length > 0) {
            imgUrl = metadata[metadata.length - 1].url;
          }
        }
        return renderArticleCard(article, imgUrl);
      });
    } else if (currentSectionType === "top-stories") {
      const capSection =
        currentSubSection.charAt(0).toUpperCase() + currentSubSection.slice(1);
      title = `Top Stories: ${capSection}`;
      url = `https://api.nytimes.com/svc/topstories/v2/${currentSubSection}.json?api-key=${API_KEY}`;

      const data = await fetchAPI(url);
      const articles = data.results || [];
      const limitedArticles = articles.slice(0, ITEMS_LIMIT);

      cardsHtml = limitedArticles.map((article) => {
        let imgUrl = null;
        if (article.multimedia && article.multimedia.length > 0) {
          const lgThumb = article.multimedia.find(
            (m) =>
              m.format === "Large Thumbnail" ||
              m.format === "threeByTwoSmallAt2X" ||
              m.format === "Super Jumbo",
          );
          imgUrl = lgThumb ? lgThumb.url : article.multimedia[0].url;
        }
        return renderArticleCard(article, imgUrl);
      });
    }

    renderGrid(title, cardsHtml, controlsHtml);
  } catch (error) {
    showError(error.message);
    console.error("NYT Explorer Error: ", error);
  }
}

function changePeriod(period) {
  currentPeriod = parseInt(period);
  loadCategory();
}

/**
 * Ejecuta la búsqueda de libros sin cambiar la categoría base (solo re-renderiza con el filtro)
 */
function executeBookSearch() {
  const searchInput = document.getElementById("book-search");
  if (searchInput) {
      currentSearchTerm = searchInput.value.trim();
      // En vez de recargar el fetch desde 0 y perder el estado, re-usamos loadCategory que 
      // aprovechará la caché, pero ahora con el valor de \`currentSearchTerm\` activo
      loadCategory(currentSectionType, currentSubSection).then(() => {
          // Restaurar el valor del input después de renderizar (porque renderGrid lo sobrescribe)
          const newSearchInput = document.getElementById("book-search");
          if (newSearchInput) {
              newSearchInput.value = currentSearchTerm;
              newSearchInput.focus();
          }
      });
  }
}

// ═══ INICIALIZACIÓN ═══
async function initApp() {
  // Cargar variables de entorno antes de cualquier fetch
  await loadEnv();

  // Validar si la API KEY pudo cargarse
  if (!API_KEY) {
      const mainContent = document.getElementById("content");
      mainContent.innerHTML = `
          <div class="error-msg">
              <strong>¡Error de Configuración!</strong><br><br>
              No se pudo cargar la <code>API_KEY</code> desde el archivo <code>.env</code>.<br><br>
              <em>Nota: Puesto que usamos Vanilla JS, para leer un archivo local (<code>.env</code>) necesitas ejecutar esto desde un <strong>Servidor Local</strong> (por ejemplo: Live Server de VSCode, XAMPP, o <code>npx http-server</code>). Si abres el archivo <code>index.html</code> directamente haciendo doble clic, el navegador bloqueará la lectura del archivo .env por políticas de seguridad (CORS).</em>
          </div>
      `;
      return;
  }

  loadCategory("books", "overview");
}

document.addEventListener("DOMContentLoaded", initApp);
