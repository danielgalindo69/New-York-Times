// ═══ CONFIGURACIÓN ═══
// Configuración de las variables de entorno
let API_KEY = "";
let API_SECRET = "";
const ITEMS_LIMIT = 20;

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
            <div class="loader-text">CARGANDO...</div>
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
    : `<div class="card-placeholder">📖</div>`;

  return `
        <article class="card">
            ${book.rank ? `<div class="card-rank">#${book.rank}</div>` : ""}
            <div class="card-badge">LIBRO</div>
            <div class="card-img-container">
                ${imgHtml}
            </div>
            <div class="card-content">
                <h3 class="card-title">${book.title || "Sin Título"}</h3>
                <div class="card-meta">
                    <div class="card-meta-item"><strong>Autor:</strong> ${book.author || "Desconocido"}</div>
                    <div class="card-meta-item"><strong>Editorial:</strong> ${book.publisher || "N/A"}</div>
                    ${book.weeks_on_list ? `<div class="card-meta-item"><strong>Semanas listado:</strong> ${book.weeks_on_list}</div>` : ""}
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
    : `<div class="card-placeholder">📰</div>`;

  const byline = article.byline
    ? article.byline.replace(/^By /i, "")
    : "Redacción NYT";

  return `
        <article class="card">
            <div class="card-badge">${article.section || "Noticias"}</div>
            <div class="card-img-container">
                ${imgHtml}
            </div>
            <div class="card-content">
                <h3 class="card-title">${article.title || "Titular de NYT"}</h3>
                <div class="card-meta">
                    <div class="card-meta-item"><strong>Autor:</strong> ${byline}</div>
                    <div class="card-meta-item"><strong>Fecha:</strong> ${formatDate(article.published_date)}</div>
                </div>
                <p class="card-desc">${article.abstract || "Resumen no disponible para este artículo."}</p>
                <a href="${article.url || "#"}" target="_blank" rel="noopener noreferrer" class="card-btn">Leer artículo</a>
            </div>
        </article>
    `;
}

function renderGrid(title, cardsHtml, controlsHtml = "", paginationHtml = "") {
  if (!cardsHtml || cardsHtml.length === 0) {
    mainContent.innerHTML = `
        <h2 class="section-title">${title}</h2>
        ${controlsHtml ? `<div class="controls">${controlsHtml}</div>` : ""}
        <div class="error-msg">
            No se encontraron resultados para esta consulta con los filtros actuales.
        </div>
    `;
    return;
  }

  mainContent.innerHTML = `
        <h2 class="section-title">${title}</h2>
        ${controlsHtml ? `<div class="controls">${controlsHtml}</div>` : ""}
        <div class="grid">
            ${cardsHtml.join("")}
        </div>
        ${paginationHtml ? `<div class="pagination-container" style="display:flex; justify-content:center; margin-top: 3rem;">${paginationHtml}</div>` : ""}
    `;
}

// ═══ NAVEGACIÓN Y TEMA ═══
let currentSectionType = "books";
let currentSubSection = "overview";
let currentPeriod = 1;
let currentSearchTerm = "";
// Nuevas variables de estado para Paginación y Filtros
let currentPage = 1;
const ITEMS_PER_PAGE = 20;
let currentAuthorFilter = "";
let currentPublisherFilter = "";
let cachedItemsForPagination = [];

function getPaginationHtml(totalPages) {
  if (totalPages <= 1) return "";
  return `
    <div style="display:flex; align-items:center; justify-content:center; gap:1rem; background: var(--card-bg); padding: 0.5rem 1rem; border-radius: 12px; border: 1px solid var(--card-border); backdrop-filter: blur(10px); margin-top:2rem;">
        <button onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? "disabled" : ""} style="padding: 0.5rem 1rem; ${currentPage === 1 ? "opacity:0.5; cursor:not-allowed;" : ""}">Anterior</button>
        <span style="font-family: var(--font-title); font-weight: bold; color: var(--text-color);">Página ${currentPage} de ${totalPages}</span>
        <button onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? "disabled" : ""} style="padding: 0.5rem 1rem; ${currentPage === totalPages ? "opacity:0.5; cursor:not-allowed;" : ""}">Siguiente</button>
    </div>
  `;
}

/**
 * Alterna entre el modo claro y oscuro.
 * Guarda la preferencia en localStorage.
 */
function toggleTheme() {
  const body = document.body;
  const isLightMode = body.classList.toggle('light-mode');
  
  // Cambiar icono del botón
  const btn = document.getElementById('theme-toggle');
  if (btn) {
      btn.innerText = isLightMode ? 'CLARO' : 'OSCURO';
  }
  
  // Guardar preferencia, aunque las keys API o resultados no usen localStorage,
  // el tema visual es útil mantenerlo.
  localStorage.setItem('nyt_theme', isLightMode ? 'light' : 'dark');
}

/**
 * Carga el tema guardado al iniciar la app
 */
function loadThemePreference() {
  const savedTheme = localStorage.getItem('nyt_theme');
  if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.innerText = '🌙';
  }
}

async function loadCategory(type, subsection, retainFilters = false) {
  if (type) currentSectionType = type;
  if (subsection) currentSubSection = subsection;
  
  if (!retainFilters) {
      currentSearchTerm = ""; 
      currentPage = 1;
      currentAuthorFilter = "";
      currentPublisherFilter = "";
  }

  showLoader();

  try {
    let url = "";
    let title = "";
    let cardsHtml = [];
    let controlsHtml = "";

    if (currentSectionType === "books") {
      let rawBooks = [];

      if (currentSubSection === "overview") {
        title = "Libros: Overview Semanal";
        url = `https://api.nytimes.com/svc/books/v3/lists/overview.json?api-key=${API_KEY}`;
        const data = await fetchAPI(url);

        if (data.results && data.results.lists) {
          for (const list of data.results.lists) {
            for (const book of list.books) {
                // Agregar categoría local para mostrar en badge
                book.local_category = list.list_name; 
                rawBooks.push(book);
            }
          }
        }
      } else {
        const secLabel =
          currentSubSection === "hardcover-fiction" ? "Ficción" : "No Ficción";
        title = `Libros: ${secLabel} (Top 15)`;
        url = `https://api.nytimes.com/svc/books/v3/lists/current/${currentSubSection}.json?api-key=${API_KEY}`;
        const data = await fetchAPI(url);
        rawBooks = data.results?.books || [];
      }

      // 1. Ya no hace falta valores únicos, ahora son inputs de texto

      // 2. Construir controles (Buscador + Buscadores por Autor/Editorial de texto)
      controlsHtml = `
          <div class="search-bar" style="display: flex; gap: 0.8rem; width: 100%; flex-wrap: wrap;">
              <input type="text" id="book-search" placeholder="Buscar por título..." value="${currentSearchTerm}"
                     style="flex-grow: 1; min-width: 250px;"
                     onkeyup="if(event.key === 'Enter') applyFilters()">
                     
              <input type="text" id="author-search" placeholder="Buscar por Autor..." value="${currentAuthorFilter}"
                     style="flex-grow: 1; min-width: 200px;"
                     onkeyup="if(event.key === 'Enter') applyFilters()">

              <input type="text" id="publisher-search" placeholder="Buscar por Editorial..." value="${currentPublisherFilter}"
                     style="flex-grow: 1; min-width: 200px;"
                     onkeyup="if(event.key === 'Enter') applyFilters()">

              <button onclick="applyFilters()">Buscar / Aplicar</button>
              ${(currentSearchTerm || currentAuthorFilter || currentPublisherFilter) ? `<button onclick="clearFilters()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5);">Limpiar</button>` : ""}
          </div>
      `;

      // 3. Aplicar Filtros Globales (Búsqueda por texto en Título, Autor y Editorial)
      let filteredBooks = rawBooks;
      
      if (currentSearchTerm) {
         const t = currentSearchTerm.toLowerCase().trim();
         filteredBooks = filteredBooks.filter(b => b.title && b.title.toLowerCase().includes(t));
      }
      
      if (currentAuthorFilter) {
          const a = currentAuthorFilter.toLowerCase().trim();
          filteredBooks = filteredBooks.filter(b => b.author && b.author.toLowerCase().includes(a));
      }

      if (currentPublisherFilter) {
          const p = currentPublisherFilter.toLowerCase().trim();
          filteredBooks = filteredBooks.filter(b => b.publisher && b.publisher.toLowerCase().includes(p));
      }

      // Guardar en cache global para paginación
      cachedItemsForPagination = filteredBooks;

      // 4. Calcular Paginación
      const totalItems = cachedItemsForPagination.length;
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;

      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedBooks = cachedItemsForPagination.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      // 5. Renderizar Tarjetas
      cardsHtml = paginatedBooks.map(book => {
          // Si el book no trae category asignada, por defecto ponemos LIBRO, sino usamos local_category
          const fixedBook = {...book, category: book.local_category || "LIBRO" };
          // Customizamos un poco renderBookCard inyectando category al HTML:
          const imgHtml = fixedBook.book_image
            ? `<img src="${fixedBook.book_image}" alt="Portada de ${fixedBook.title}" class="card-img" loading="lazy">`
            : `<div class="card-placeholder">📖</div>`;

          return `
                <article class="card">
                    ${fixedBook.rank ? `<div class="card-rank">#${fixedBook.rank}</div>` : ""}
                    <div class="card-badge">${fixedBook.category.toUpperCase()}</div>
                    <div class="card-img-container">
                        ${imgHtml}
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">${fixedBook.title || "Sin Título"}</h3>
                        <div class="card-meta">
                            <div class="card-meta-item"><strong>Autor:</strong> ${fixedBook.author || "Desconocido"}</div>
                            <div class="card-meta-item"><strong>Editorial:</strong> ${fixedBook.publisher || "N/A"}</div>
                            ${fixedBook.weeks_on_list ? `<div class="card-meta-item"><strong>Semanas listado:</strong> ${fixedBook.weeks_on_list}</div>` : ""}
                        </div>
                        <p class="card-desc">${fixedBook.description || "Sin descripción disponible para este título."}</p>
                        <a href="${fixedBook.amazon_product_url || "#"}" target="_blank" rel="noopener noreferrer" class="card-btn">Ver en Amazon</a>
                    </div>
                </article>
            `;
      });

      // 6. Generar HTML de Paginación
      const paginationHtml = getPaginationHtml(totalPages);

      renderGrid(title, cardsHtml, controlsHtml, paginationHtml);
      return; 
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

      cachedItemsForPagination = data.results || [];
      const totalItems = cachedItemsForPagination.length;
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedArticles = cachedItemsForPagination.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      cardsHtml = paginatedArticles.map((article) => {
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

      const paginationHtml = getPaginationHtml(totalPages);
      renderGrid(title, cardsHtml, controlsHtml, paginationHtml);
    } else if (currentSectionType === "top-stories") {
      const capSection =
        currentSubSection.charAt(0).toUpperCase() + currentSubSection.slice(1);
      title = `Top Stories: ${capSection}`;
      url = `https://api.nytimes.com/svc/topstories/v2/${currentSubSection}.json?api-key=${API_KEY}`;

      const data = await fetchAPI(url);
      cachedItemsForPagination = data.results || [];
      const totalItems = cachedItemsForPagination.length;
      const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
      if (currentPage > totalPages && totalPages > 0) currentPage = totalPages;
      const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
      const paginatedArticles = cachedItemsForPagination.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      cardsHtml = paginatedArticles.map((article) => {
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

      const paginationHtml = getPaginationHtml(totalPages);
      renderGrid(title, cardsHtml, controlsHtml, paginationHtml);
    }
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
 * Lee el estado actual de los inputs de texto y ejecuta la búsqueda
 */
function applyFilters() {
    currentPage = 1;

    // Obtener valores de texto
    const titleInput = document.getElementById('book-search');
    const authorInput = document.getElementById('author-search');
    const pubInput = document.getElementById('publisher-search');

    currentSearchTerm = titleInput ? titleInput.value : "";
    currentAuthorFilter = authorInput ? authorInput.value : "";
    currentPublisherFilter = pubInput ? pubInput.value : "";

    // Disparar recarga conservando estado nuevo
    executeBookSearch();
}

/**
 * Ir a la página y recompilar
 */
function goToPage(page) {
    currentPage = page;
    // recargar con keepFilters=true
    loadCategory(currentSectionType, currentSubSection, true).then(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

function clearFilters() {
    currentSearchTerm = "";
    currentAuthorFilter = "";
    currentPublisherFilter = "";
    currentPage = 1;
    loadCategory(currentSectionType, currentSubSection, true);
}

function executeBookSearch() {
  const searchInput = document.getElementById("book-search");
  if (searchInput) {
      currentSearchTerm = searchInput.value.trim();
  }
  currentPage = 1;
  loadCategory(currentSectionType, currentSubSection, true).then(() => {
      const newSearchInput = document.getElementById("book-search");
      if (newSearchInput) {
          newSearchInput.value = currentSearchTerm;
          // focus opcional dependiendo de la UX
      }
  });
}

// Manejo estricto de los eventos del navbar móvil y menús del NYT
document.addEventListener('click', function(event) {
    // Menú hamburguesa global
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mainNav = document.getElementById('main-nav');
    
    if (mobileBtn && event.target === mobileBtn) {
        mainNav.classList.toggle('active');
        mobileBtn.innerText = mainNav.classList.contains('active') ? '✕' : '☰';
        return; // Detener aquí para el menú hamburguesa
    }
    
    // Expandir dropdowns SOLO en moviles haciendo click sobre la categoria Padre
    if (window.innerWidth <= 760 && mainNav && mainNav.classList.contains('active')) {
      const clickedLi = event.target.closest('nav#main-nav li');
      if (clickedLi) {
         // Si hicimos click exactamente en una opcion interior del dropdown (ej un enlace), cerrar menú entero
         if (event.target.tagName.toLowerCase() === 'a' && !event.target.classList.contains('menu-toggle')) {
            mainNav.classList.remove('active');
            if(mobileBtn) mobileBtn.innerText = '☰';
            return;
         }
         
         // Si se hizo click en el padre, togglear clase
         clickedLi.classList.toggle('active-mobile');
         // Cerrar los demas
         document.querySelectorAll('nav#main-nav li').forEach(li => {
             if (li !== clickedLi) li.classList.remove('active-mobile');
         });
      }
    }
});

// ═══ INICIALIZACIÓN ═══
async function initApp() {
  // Cargar tema guardado antes de que termine de renderizar la pantalla
  loadThemePreference();

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
