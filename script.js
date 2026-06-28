// ── FIREBASE SETUP ───────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc,
  arrayUnion, arrayRemove, query, orderBy, onSnapshot, serverTimestamp, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB_UY3GS5sZ4CBNDMy5c0WrFITRaago_Zo",
  authDomain: "cinelog-foro.firebaseapp.com",
  projectId: "cinelog-foro",
  storageBucket: "cinelog-foro.firebasestorage.app",
  messagingSenderId: "579298585147",
  appId: "1:579298585147:web:c8c3aeacc0482855128a1e"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── OMDB API ─────────────────────────────────────────────
// Reemplazá con tu API key de omdbapi.com
const OMDB_KEY = "764a2671";
const OMDB_URL = `https://www.omdbapi.com/?apikey=${OMDB_KEY}`;

// ── REFERENCIAS HTML ─────────────────────────────────────
const btnLogin          = document.getElementById("btnLogin");
const btnLogout         = document.getElementById("btnLogout");
const userInfo          = document.getElementById("userInfo");
const userAvatar        = document.getElementById("userAvatar");
const userNombre        = document.getElementById("userNombre");
const seccionNuevo      = document.getElementById("seccionNuevo");
const inputPelicula     = document.getElementById("inputPelicula");
const btnBuscarPeli     = document.getElementById("btnBuscarPeli");
const peliSeleccionada  = document.getElementById("peliSeleccionada");
const peliThumb         = document.getElementById("peliThumb");
const peliTituloSel     = document.getElementById("peliTituloSel");
const peliAnioSel       = document.getElementById("peliAnioSel");
const btnCambiarPeli    = document.getElementById("btnCambiarPeli");
const inputReseña       = document.getElementById("inputReseña");
const inputPuntaje      = document.getElementById("inputPuntaje");
const puntajeValor      = document.getElementById("puntajeValor");
const btnPublicar       = document.getElementById("btnPublicar");
const formError         = document.getElementById("formError");
const feed              = document.getElementById("feed");
const estadoMsg         = document.getElementById("estadoMsg");
const modal             = document.getElementById("modal");
const modalTituloPost   = document.getElementById("modalTituloPost");
const modalResenia      = document.getElementById("modalResenia");
const modalRespuestas   = document.getElementById("modalRespuestas");
const modalFormRespuesta= document.getElementById("modalFormRespuesta");
const modalLoginAviso   = document.getElementById("modalLoginAviso");
const inputRespuesta    = document.getElementById("inputRespuesta");
const btnEnviarRespuesta= document.getElementById("btnEnviarRespuesta");
const btnCerrarModal    = document.getElementById("btnCerrarModal");
const overlay           = document.getElementById("overlay");
const toast             = document.getElementById("toast");

// ── ESTADO ───────────────────────────────────────────────
let usuarioActual  = null;   // objeto de Firebase Auth
let peliElegida    = null;   // película seleccionada para el post
let postAbierto    = null;   // id del post abierto en el modal
let filtroActivo   = "recientes";

// ── AUTENTICACIÓN ─────────────────────────────────────────

// Detectamos si el usuario entra o sale
onAuthStateChanged(auth, (usuario) => {
  usuarioActual = usuario;

  if (usuario) {
    // Hay sesión iniciada
    userAvatar.src      = usuario.photoURL || "";
    userNombre.textContent = usuario.displayName?.split(" ")[0] || "Usuario";
    userInfo.classList.remove("hidden");
    btnLogin.classList.add("hidden");
    seccionNuevo.classList.remove("hidden");
  } else {
    // No hay sesión
    userInfo.classList.add("hidden");
    btnLogin.classList.remove("hidden");
    seccionNuevo.classList.add("hidden");
  }
});

// Entrar con Google
btnLogin.addEventListener("click", () => {
  const provider = new GoogleAuthProvider();
  signInWithPopup(auth, provider).catch((err) => {
    mostrarToast("No se pudo iniciar sesión. Intentá de nuevo.");
    console.error(err);
  });
});

// Salir
btnLogout.addEventListener("click", () => {
  signOut(auth);
  mostrarToast("Sesión cerrada.");
});

// ── BÚSQUEDA DE PELÍCULA ──────────────────────────────────

btnBuscarPeli.addEventListener("click", buscarPelicula);
inputPelicula.addEventListener("keydown", (e) => {
  if (e.key === "Enter") buscarPelicula();
});

async function buscarPelicula() {
  const q = inputPelicula.value.trim();
  if (!q) return;

  btnBuscarPeli.textContent = "…";
  btnBuscarPeli.disabled = true;

  try {
    const res  = await fetch(`${OMDB_URL}&s=${encodeURIComponent(q)}&type=movie`);
    const data = await res.json();

    if (data.Response === "False") {
      mostrarError("No encontramos esa película. Probá otro título.");
    } else {
      // Tomamos el primer resultado
      const primera = data.Search[0];
      seleccionarPelicula(primera);
    }
  } catch {
    mostrarError("Error de conexión al buscar.");
  } finally {
    btnBuscarPeli.textContent = "Buscar";
    btnBuscarPeli.disabled = false;
  }
}

function seleccionarPelicula(peli) {
  peliElegida = peli;
  peliThumb.src         = peli.Poster !== "N/A" ? peli.Poster : "";
  peliTituloSel.textContent = peli.Title;
  peliAnioSel.textContent   = peli.Year;
  peliSeleccionada.classList.remove("hidden");
  inputPelicula.value = "";
  ocultarError();
}

btnCambiarPeli.addEventListener("click", () => {
  peliElegida = null;
  peliSeleccionada.classList.add("hidden");
  inputPelicula.focus();
});

// ── PUNTAJE SLIDER ────────────────────────────────────────
inputPuntaje.addEventListener("input", () => {
  puntajeValor.textContent = `${inputPuntaje.value} / 10`;
});

// ── PUBLICAR POST ─────────────────────────────────────────
btnPublicar.addEventListener("click", publicarPost);

async function publicarPost() {
  if (!usuarioActual) {
    mostrarError("Tenés que iniciar sesión para publicar.");
    return;
  }
  if (!peliElegida) {
    mostrarError("Buscá y seleccioná una película primero.");
    return;
  }
  const texto = inputReseña.value.trim();
  if (texto.length < 10) {
    mostrarError("Escribí al menos 10 caracteres en tu recomendación.");
    return;
  }

  btnPublicar.textContent = "Publicando…";
  btnPublicar.disabled    = true;

  try {
    await addDoc(collection(db, "posts"), {
      autor: {
        uid:    usuarioActual.uid,
        nombre: usuarioActual.displayName,
        foto:   usuarioActual.photoURL,
      },
      pelicula: {
        imdbID: peliElegida.imdbID,
        titulo: peliElegida.Title,
        anio:   peliElegida.Year,
        poster: peliElegida.Poster,
      },
      resenia:    texto,
      puntaje:    Number(inputPuntaje.value),
      likes:      [],          // array de UIDs que dieron like
      respuestas: 0,           // contador
      creadoEn:   serverTimestamp(),
    });

    // Limpiamos el formulario
    inputReseña.value   = "";
    inputPuntaje.value  = 7;
    puntajeValor.textContent = "7 / 10";
    peliElegida = null;
    peliSeleccionada.classList.add("hidden");
    ocultarError();
    mostrarToast("¡Recomendación publicada! 🎬");

  } catch (err) {
    mostrarError("No se pudo publicar. Intentá de nuevo.");
    console.error(err);
  } finally {
    btnPublicar.textContent = "Publicar recomendación";
    btnPublicar.disabled    = false;
  }
}

// ── LEER POSTS EN TIEMPO REAL ─────────────────────────────
const qPosts = query(collection(db, "posts"), orderBy("creadoEn", "desc"));

onSnapshot(qPosts, (snapshot) => {
  const posts = [];
  snapshot.forEach(doc => posts.push({ id: doc.id, ...doc.data() }));
  renderizarFeed(posts);
});

function renderizarFeed(posts) {
  if (posts.length === 0) {
    estadoMsg.style.display = "";
    estadoMsg.textContent   = "Todavía no hay recomendaciones. ¡Sé el primero! 🎬";
    feed.innerHTML = "";
    return;
  }

  estadoMsg.style.display = "none";

  // Ordenamos según filtro
  const ordenados = [...posts].sort((a, b) => {
    if (filtroActivo === "likes") return b.likes.length - a.likes.length;
    // recientes: ya vienen ordenados de Firestore
    return 0;
  });

  feed.innerHTML = "";
  ordenados.forEach(post => {
    feed.appendChild(crearTarjetaPost(post));
  });
}

// ── CREAR TARJETA DE POST ─────────────────────────────────
function crearTarjetaPost(post) {
  const div = document.createElement("div");
  div.className = "post";
  div.dataset.id = post.id;

  const yaLiked  = usuarioActual && post.likes.includes(usuarioActual.uid);
  const fecha    = post.creadoEn?.toDate ? formatearFecha(post.creadoEn.toDate()) : "ahora";
  const poster   = post.pelicula.poster !== "N/A" ? post.pelicula.poster : "";

  div.innerHTML = `
    <div class="post-header">
      <img class="post-avatar" src="${post.autor.foto || ''}" alt="${post.autor.nombre}" onerror="this.style.display='none'">
      <div class="post-meta">
        <p class="post-autor">${post.autor.nombre}</p>
        <p class="post-fecha">${fecha}</p>
      </div>
      <span class="post-puntaje">⭐ ${post.puntaje}/10</span>
    </div>

    <div class="post-pelicula">
      <img class="post-poster" src="${poster}" alt="${post.pelicula.titulo}" onerror="this.style.display='none'">
      <div>
        <p class="post-peli-nombre">${post.pelicula.titulo}</p>
        <p class="post-peli-anio">${post.pelicula.anio}</p>
      </div>
    </div>

    <p class="post-resenia">${post.resenia}</p>

    <div class="post-acciones">
      <button class="btn-like ${yaLiked ? 'liked' : ''}" data-id="${post.id}">
        ${yaLiked ? '❤️' : '🤍'} <span class="count">${post.likes.length}</span>
      </button>
      <button class="btn-responder" data-id="${post.id}">
        💬 ${post.respuestas || 0} respuestas
      </button>
    </div>
  `;

  // Evento like
  div.querySelector(".btn-like").addEventListener("click", (e) => {
    e.stopPropagation();
    toggleLike(post.id, post.likes);
  });

  // Evento abrir modal de respuestas
  div.querySelector(".btn-responder").addEventListener("click", () => {
    abrirModal(post);
  });

  return div;
}

// ── LIKES ─────────────────────────────────────────────────
async function toggleLike(postId, likesActuales) {
  if (!usuarioActual) {
    mostrarToast("Iniciá sesión para dar like 👆");
    return;
  }

  const ref = doc(db, "posts", postId);
  const yaLiked = likesActuales.includes(usuarioActual.uid);

  try {
    await updateDoc(ref, {
      likes: yaLiked
        ? arrayRemove(usuarioActual.uid)
        : arrayUnion(usuarioActual.uid)
    });
  } catch (err) {
    console.error("Error al dar like:", err);
  }
}

// ── MODAL DE RESPUESTAS ───────────────────────────────────
async function abrirModal(post) {
  postAbierto = post.id;
  modalTituloPost.textContent = `${post.pelicula.titulo} — ${post.autor.nombre}`;
  modalResenia.textContent    = post.resenia;

  // Mostramos u ocultamos el formulario según si hay sesión
  if (usuarioActual) {
    modalFormRespuesta.classList.remove("hidden");
    modalLoginAviso.classList.add("hidden");
  } else {
    modalFormRespuesta.classList.add("hidden");
    modalLoginAviso.classList.remove("hidden");
  }

  modal.classList.remove("hidden");
  overlay.classList.remove("hidden");
  inputRespuesta.value = "";

  // Cargamos las respuestas
  cargarRespuestas(post.id);
}

async function cargarRespuestas(postId) {
  modalRespuestas.innerHTML = "<p class='sin-respuestas'>Cargando…</p>";

  try {
    const qResp = query(
      collection(db, "posts", postId, "respuestas"),
      orderBy("creadoEn", "asc")
    );
    const snap = await getDocs(qResp);

    if (snap.empty) {
      modalRespuestas.innerHTML = "<p class='sin-respuestas'>Todavía no hay respuestas. ¡Sé el primero!</p>";
      return;
    }

    modalRespuestas.innerHTML = "";
    snap.forEach(d => {
      const r = d.data();
      const fecha = r.creadoEn?.toDate ? formatearFecha(r.creadoEn.toDate()) : "";
      const div = document.createElement("div");
      div.className = "respuesta";
      div.innerHTML = `
        <img class="resp-avatar" src="${r.autor.foto || ''}" alt="" onerror="this.style.display='none'">
        <div class="resp-body">
          <p class="resp-autor">${r.autor.nombre}</p>
          <p class="resp-texto">${r.texto}</p>
          <p class="resp-fecha">${fecha}</p>
        </div>
      `;
      modalRespuestas.appendChild(div);
    });
  } catch (err) {
    modalRespuestas.innerHTML = "<p class='sin-respuestas'>Error al cargar respuestas.</p>";
    console.error(err);
  }
}

btnEnviarRespuesta.addEventListener("click", async () => {
  const texto = inputRespuesta.value.trim();
  if (!texto || !postAbierto || !usuarioActual) return;

  btnEnviarRespuesta.disabled    = true;
  btnEnviarRespuesta.textContent = "Enviando…";

  try {
    // Guardamos la respuesta en una subcolección
    await addDoc(collection(db, "posts", postAbierto, "respuestas"), {
      autor: {
        uid:    usuarioActual.uid,
        nombre: usuarioActual.displayName,
        foto:   usuarioActual.photoURL,
      },
      texto,
      creadoEn: serverTimestamp(),
    });

    // Actualizamos el contador de respuestas en el post
    await updateDoc(doc(db, "posts", postAbierto), {
      respuestas: (await getDoc(doc(db, "posts", postAbierto))).data().respuestas + 1
    });

    inputRespuesta.value = "";
    cargarRespuestas(postAbierto);
    mostrarToast("Respuesta publicada 💬");

  } catch (err) {
    mostrarToast("No se pudo enviar. Intentá de nuevo.");
    console.error(err);
  } finally {
    btnEnviarRespuesta.disabled    = false;
    btnEnviarRespuesta.textContent = "Responder";
  }
});

function cerrarModal() {
  modal.classList.add("hidden");
  overlay.classList.add("hidden");
  postAbierto = null;
}
btnCerrarModal.addEventListener("click", cerrarModal);
overlay.addEventListener("click", cerrarModal);
document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });

// Login desde el modal
document.getElementById("btnLoginModal").addEventListener("click", () => {
  cerrarModal();
  new GoogleAuthProvider();
  signInWithPopup(auth, new GoogleAuthProvider());
});

// ── FILTROS ───────────────────────────────────────────────
document.querySelectorAll(".filtro").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filtro").forEach(b => b.classList.remove("activo"));
    btn.classList.add("activo");
    filtroActivo = btn.dataset.filtro;
    // Re-renderizamos con el mismo snapshot (onSnapshot ya tiene los datos)
    // Disparamos un snapshot manual
    getDocs(query(collection(db, "posts"), orderBy("creadoEn", "desc")))
      .then(snap => {
        const posts = [];
        snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
        renderizarFeed(posts);
      });
  });
});

// ── UTILIDADES ────────────────────────────────────────────
function formatearFecha(fecha) {
  const ahora = new Date();
  const diff  = Math.floor((ahora - fecha) / 1000); // segundos

  if (diff < 60)   return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)return `hace ${Math.floor(diff / 3600)} h`;
  return fecha.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function mostrarError(msg) {
  formError.textContent = msg;
  formError.classList.remove("hidden");
}
function ocultarError() {
  formError.classList.add("hidden");
}

let toastTimer;
function mostrarToast(msg) {
  toast.textContent = msg;
  toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3000);
}