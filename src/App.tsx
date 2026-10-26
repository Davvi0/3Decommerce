
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowRight,
  ArrowUpRight,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react'
import Wardrobe3D, {
  type WardrobePiece,
} from './Wardrobe3D'
import './App.css'

type Product = WardrobePiece & {
  category: string
  collections: string[]
  price: number
  description: string
  material: string
  fit: string
}

type CartItem = {
  product: Product
  size: string
  quantity: number
}

const PRODUCTS: Product[] = [
  {
    id: 'essential-tee',
    name: 'Essential Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN', 'STUDIO PICKS'],
    color: '#d2cdc3',
    price: 189,
    description: 'Uma peça essencial de linhas limpas, pensada para diferentes estilos.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'heavyweight-tee',
    name: 'Heavyweight Tee',
    category: 'T-SHIRTS',
    collections: ['STUDIO PICKS'],
    color: '#30312d',
    price: 219,
    description: 'Uma silhueta minimalista em um tom profundo e contemporâneo.',
    material: 'Algodão — composição a confirmar',
    fit: 'Relaxed fit',
  },
  {
    id: 'studio-tee',
    name: 'Studio Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN'],
    color: '#777e68',
    price: 199,
    description: 'Uma tonalidade natural para composições discretas e versáteis.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'core-tee',
    name: 'Core Tee',
    category: 'T-SHIRTS',
    collections: ['STUDIO PICKS'],
    color: '#171815',
    price: 189,
    description: 'Uma camiseta escura de estética essencial e presença marcante.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'clay-tee',
    name: 'Clay Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN'],
    color: '#a65f48',
    price: 199,
    description: 'Um tom terroso que adiciona calor a composições essenciais.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'ocean-tee',
    name: 'Ocean Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN', 'STUDIO PICKS'],
    color: '#526b7a',
    price: 199,
    description: 'Uma tonalidade azul profunda de visual contemporâneo.',
    material: 'Algodão — composição a confirmar',
    fit: 'Relaxed fit',
  },
  {
    id: 'berry-tee',
    name: 'Berry Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN'],
    color: '#75464d',
    price: 199,
    description: 'Um tom de vinho discreto para destacar o essencial.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'sand-tee',
    name: 'Sand Tee',
    category: 'T-SHIRTS',
    collections: ['STUDIO PICKS'],
    color: '#b8a487',
    price: 189,
    description: 'Uma cor areia versátil, inspirada em tons naturais.',
    material: 'Algodão — composição a confirmar',
    fit: 'Regular fit',
  },
  {
    id: 'lilac-tee',
    name: 'Lilac Tee',
    category: 'T-SHIRTS',
    collections: ['NEW IN'],
    color: '#8a7b91',
    price: 199,
    description: 'Uma nuance lilás suave para uma composição singular.',
    material: 'Algodão — composição a confirmar',
    fit: 'Relaxed fit',
  },
]

const NAV_ITEMS = [
  { label: 'ALL', value: 'ALL PIECES' },
  { label: 'T-SHIRTS', value: 'T-SHIRTS' },
  { label: 'NEW IN', value: 'NEW IN' },
  { label: 'SELECTED', value: 'STUDIO PICKS' },
]

const SEARCH_SUGGESTIONS = [
  { label: 'Preta', query: 'preta' },
  { label: 'Verde oliva', query: 'oliva' },
  { label: 'Tons neutros', query: 'bege' },
  { label: 'Novidades', query: 'novidades' },
]

const PRODUCT_SEARCH_TERMS: Record<string, string> = {
  'essential-tee':
    'bege areia creme claro clara off white offwhite neutra neutro básica basica essencial clean algodão',
  'heavyweight-tee':
    'cinza grafite carvão escura escuro pesada pesado heavyweight cinza escuro relaxada relaxed',
  'studio-tee':
    'verde oliva oliva sage natural verde militar discreta',
  'core-tee':
    'preta preto black escura escuro básica basica essencial minimalista',
  'clay-tee':
    'terracota tijolo telha marrom terra queimado clay laranja',
  'ocean-tee':
    'azul azul marinho oceano ocean azul profundo azul escuro',
  'berry-tee':
    'vinho bordô bordo burgundy berry vermelho escuro',
  'sand-tee':
    'areia bege caqui sand neutra neutro natural clara claro',
  'lilac-tee':
    'lilás lilas lavanda roxo violeta lilac lilac pastel',
}

const SIZES = ['S', 'M', 'L', 'XL']
const CART_STORAGE_KEY = 'forme-cart-v1'

function normalizeSearch(value: string) {
  return value
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getSearchText(product: Product) {
  const collectionTerms = [
    product.collections.join(' '),
    product.collections.includes('NEW IN')
      ? 'novidades novidade lancamentos lancamento recentes'
      : '',
    product.collections.includes('STUDIO PICKS')
      ? 'destaques destaque selecionados selecao curadoria favoritos'
      : '',
  ].join(' ')

  return normalizeSearch([
    product.name,
    product.category,
    product.description,
    product.material,
    product.fit,
    product.id,
    'roupa roupas camiseta camisetas tshirt tshirts streetwear',
    PRODUCT_SEARCH_TERMS[product.id] ?? '',
    collectionTerms,
  ].join(' '))
}

function loadCart(): CartItem[] {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY)
    if (!stored) return []

    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is CartItem => {
      if (!item || typeof item !== 'object') return false

      const value = item as Partial<CartItem>

      return (
        !!value.product &&
        typeof value.product.id === 'string' &&
        typeof value.product.price === 'number' &&
        typeof value.size === 'string' &&
        typeof value.quantity === 'number' &&
        value.quantity > 0
      )
    })
  } catch {
    return []
  }
}

function App() {
  const [activeCategory, setActiveCategory] = useState('ALL PIECES')
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedSize, setSelectedSize] = useState('M')
  const [cart, setCart] = useState<CartItem[]>(loadCart)
  const [bagOpen, setBagOpen] = useState(false)

  // Estado da pesquisa.
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const visibleProducts = useMemo(
    () =>
      PRODUCTS.filter(
        (product) =>
          activeCategory === 'ALL PIECES' ||
          product.category === activeCategory ||
          product.collections.includes(activeCategory),
      ),
    [activeCategory],
  )

  const safeIndex = Math.min(
    activeIndex,
    Math.max(visibleProducts.length - 1, 0),
  )

  const searchResults = useMemo(() => {
    const query = normalizeSearch(searchQuery)

    if (!query) return []

    const terms = query.split(' ').filter(Boolean)

    return PRODUCTS.filter((product) => {
      const searchableText = getSearchText(product)
      return terms.every((term) => searchableText.includes(term))
    }).slice(0, 8)
  }, [searchQuery])

  const cartCount = cart.reduce(
    (total, item) => total + item.quantity,
    0,
  )

  const cartTotal = cart.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  )

  const activeNavIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.value === activeCategory),
  )

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value)

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    } catch (error) {
      console.error('Não foi possível salvar a sacola.', error)
    }
  }, [cart])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setSelectedProduct(null)
        setBagOpen(false)
        return
      }

      if (
        searchOpen ||
        selectedProduct ||
        bagOpen ||
        visibleProducts.length === 0
      ) {
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        setActiveIndex((current) => (current + 1) % visibleProducts.length)
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActiveIndex(
          (current) =>
            (current - 1 + visibleProducts.length) % visibleProducts.length,
        )
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen, selectedProduct, bagOpen, visibleProducts])

  function changeCategory(category: string) {
    setActiveCategory(category)
    setActiveIndex(0)
  }

  function selectPiece(index: number) {
    const product = visibleProducts[index]
    if (!product) return

    // Primeiro clique: seleciona e centraliza.
    if (index !== safeIndex) {
      setActiveIndex(index)
      return
    }

    // Segundo clique na peça centralizada: abre os detalhes.
    setSelectedProduct(product)
    setSelectedSize('M')
  }

  function toggleSearch() {
    if (searchOpen) {
      setSearchOpen(false)
      return
    }

    setSearchQuery('')
    setSelectedProduct(null)
    setBagOpen(false)
    setSearchOpen(true)
  }

  function selectSearchResult(product: Product) {
    // Coloca o produto encontrado no centro do closet.
    setActiveCategory('ALL PIECES')
    setActiveIndex(PRODUCTS.findIndex((item) => item.id === product.id))

    setSearchOpen(false)
    setSearchQuery('')
    setSelectedProduct(product)
    setSelectedSize('M')
  }

  function addToBag() {
    if (!selectedProduct) return

    setCart((current) => {
      const existing = current.find(
        (item) =>
          item.product.id === selectedProduct.id &&
          item.size === selectedSize,
      )

      if (existing) {
        return current.map((item) =>
          item.product.id === selectedProduct.id &&
          item.size === selectedSize
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        )
      }

      return [
        ...current,
        {
          product: selectedProduct,
          size: selectedSize,
          quantity: 1,
        },
      ]
    })

    setSelectedProduct(null)
    setBagOpen(true)
  }

  function changeQuantity(
    productId: string,
    size: string,
    change: number,
  ) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId && item.size === size
            ? { ...item, quantity: item.quantity + change }
            : item,
        )
        .filter((item) => item.quantity > 0),
    )
  }

  function removeCartItem(productId: string, size: string) {
    setCart((current) =>
      current.filter(
        (item) =>
          item.product.id !== productId || item.size !== size,
      ),
    )
  }

  return (
    <main className="store">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Forme Studio">
          FORME<span>.</span>
        </a>

        <nav className="dynamic-island" aria-label="Navegação da loja">
          <span
            className="island-active-bg"
            aria-hidden="true"
            style={{
              transform: `translateX(${activeNavIndex * 100}%)`,
            }}
          />

          {NAV_ITEMS.map((item) => (
            <button
              key={item.value}
              className={
                activeCategory === item.value
                  ? 'island-link active'
                  : 'island-link'
              }
              onClick={() => changeCategory(item.value)}
              aria-pressed={activeCategory === item.value}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topbar-actions">
          <button
            className="search-toggle"
            onClick={toggleSearch}
            aria-label="Pesquisar roupas"
            aria-expanded={searchOpen}
            title="Pesquisar roupas"
          >
            <Search size={19} strokeWidth={1.7} />
          </button>

          <button
            className="bag-button"
            onClick={() => {
              setSearchOpen(false)
              setBagOpen(true)
            }}
            aria-label={`Sacola, ${cartCount} itens`}
          >
            <ShoppingBag size={19} strokeWidth={1.6} />
            <span className="bag-count">
              {String(cartCount).padStart(2, '0')}
            </span>
          </button>
        </div>
      </header>

      {/* Pesquisa de produtos. */}
      {searchOpen && (
        <div
          className="search-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSearchOpen(false)
            }
          }}
        >
          <section
            className="search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Pesquisar produtos"
          >
            <div className="search-panel-header">
              <div className="search-input-wrap">
                <Search
                  size={20}
                  strokeWidth={1.7}
                  aria-hidden="true"
                />

                <input
                  type="search"
                  className="search-input"
                  placeholder="Pesquisar roupas, cores, estilos..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  autoFocus
                  aria-label="Buscar produtos por nome, cor ou estilo"
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && searchResults[0]) {
                      event.preventDefault()
                      selectSearchResult(searchResults[0])
                    }
                  }}
                />

                <kbd>ESC</kbd>
              </div>

              <button
                className="search-close"
                onClick={() => setSearchOpen(false)}
                aria-label="Fechar pesquisa"
              >
                <X size={19} />
              </button>
            </div>

            <div className="search-panel-body">
              <div className="search-meta">
                <span>
                  {searchQuery.trim()
                    ? `${searchResults.length} ${
                        searchResults.length === 1
                          ? 'RESULTADO'
                          : 'RESULTADOS'
                      }`
                    : 'ENCONTRE SUA PRÓXIMA PEÇA'}
                </span>

                <span>FORME / SEARCH</span>
              </div>

              {!searchQuery.trim() && (
                <>
                  <p className="search-section-title">
                    EXPLORE POR CATEGORIA
                  </p>

                  <div className="search-suggestions">
                    {SEARCH_SUGGESTIONS.map((suggestion) => (
                      <button
                        className="search-chip"
                        key={suggestion.query}
                        onClick={() => setSearchQuery(suggestion.query)}
                      >
                        {suggestion.label}
                        <ArrowUpRight size={13} />
                      </button>
                    ))}
                  </div>

                  <p className="search-section-title">
                    PEÇAS EM DESTAQUE
                  </p>
                </>
              )}

              {searchQuery.trim() && searchResults.length === 0 && (
                <div className="search-empty">
                  <Search size={25} strokeWidth={1.4} />

                  <strong>Nenhuma peça encontrada</strong>

                  <p>
                    Tente outro nome, cor ou estilo. Você também pode
                    pesquisar por termos como “preta”, “verde”, “bege”
                    ou “novidades”.
                  </p>

                  <button
                    className="search-reset"
                    onClick={() => setSearchQuery('')}
                  >
                    LIMPAR PESQUISA
                  </button>
                </div>
              )}

              {(!searchQuery.trim() || searchResults.length > 0) && (
                <div className="search-results" aria-live="polite">
                  {(searchQuery.trim()
                    ? searchResults
                    : PRODUCTS.slice(0, 4)
                  ).map((product) => (
                    <button
                      className="search-result"
                      key={product.id}
                      onClick={() => selectSearchResult(product)}
                    >
                      <span
                        className="search-result-swatch"
                        style={{ backgroundColor: product.color }}
                        aria-hidden="true"
                      />

                      <span className="search-result-copy">
                        <strong>{product.name}</strong>

                        <span>
                          {product.fit} · {product.collections[0]}
                        </span>
                      </span>

                      <span className="search-result-price">
                        {formatMoney(product.price)}
                      </span>

                      <ArrowUpRight
                        className="search-result-arrow"
                        size={16}
                      />
                    </button>
                  ))}
                </div>
              )}

              <div className="search-footer">
                <span>FORME STUDIO</span>
                <span>DESIGNED TO BE DISCOVERED.</span>
              </div>
            </div>
          </section>
        </div>
      )}

      <section
        className="showroom"
        id="top"
        aria-label="Guarda-roupa interativo"
      >
        <div className="showroom-glow showroom-glow-one" />
        <div className="showroom-glow showroom-glow-two" />

        <div className="wardrobe-stage">
          <Wardrobe3D
            pieces={visibleProducts}
            activeIndex={safeIndex}
            onSelect={selectPiece}
            onNavigate={setActiveIndex}
            mode="wardrobe"
          />
        </div>
      </section>

      {selectedProduct && (
        <div
          className="overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProduct(null)
            }
          }}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Detalhes de ${selectedProduct.name}`}
          >
            <div className="modal-visual">
              <Wardrobe3D
                pieces={[selectedProduct]}
                activeIndex={0}
                onSelect={() => {}}
                mode="detail"
              />

              <div className="modal-visual-label">
                <span>FORME / OBJECT 001</span>
                <span>DRAG TO ROTATE</span>
              </div>

              <button
                className="close-button modal-close"
                onClick={() => setSelectedProduct(null)}
                aria-label="Fechar produto"
              >
                <X size={19} />
              </button>
            </div>

            <div className="modal-info">
              <div className="eyebrow">
                COLLECTION 001
                <span className="eyebrow-divider" />
                {selectedProduct.category}
              </div>

              <h1>{selectedProduct.name}</h1>

              <p className="modal-price">
                {formatMoney(selectedProduct.price)}
              </p>

              <p className="modal-description">
                {selectedProduct.description}
              </p>

              <div className="product-specs">
                <div>
                  <span>MATERIAL</span>
                  <p>{selectedProduct.material}</p>
                </div>

                <div>
                  <span>FIT</span>
                  <p>{selectedProduct.fit}</p>
                </div>
              </div>

              <span className="field-label">COLOR</span>

              <div className="color-row">
                {PRODUCTS.map((product) => (
                  <button
                    key={product.id}
                    className={
                      selectedProduct.id === product.id
                        ? 'color-swatch selected'
                        : 'color-swatch'
                    }
                    style={{ backgroundColor: product.color }}
                    onClick={() => setSelectedProduct(product)}
                    title={product.name}
                    aria-label={product.name}
                    aria-pressed={selectedProduct.id === product.id}
                  />
                ))}

                <span className="color-name">
                  {selectedProduct.name}
                </span>
              </div>

              <span className="field-label">SIZE</span>

              <div className="sizes">
                {SIZES.map((size) => (
                  <button
                    key={size}
                    className={
                      selectedSize === size ? 'size active' : 'size'
                    }
                    onClick={() => setSelectedSize(size)}
                    aria-pressed={selectedSize === size}
                  >
                    {size}
                  </button>
                ))}
              </div>

              <button className="add-button" onClick={addToBag}>
                ADD TO BAG
                <span>{formatMoney(selectedProduct.price)}</span>
                <ArrowUpRight size={18} />
              </button>

              <p className="modal-note">
                Produto demonstrativo. Checkout ainda não integrado.
              </p>
            </div>
          </section>
        </div>
      )}

      {bagOpen && (
        <div
          className="overlay bag-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setBagOpen(false)
            }
          }}
        >
          <aside
            className="bag-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Sua sacola"
          >
            <div className="drawer-heading">
              <div>
                <span className="eyebrow">YOUR SELECTION</span>

                <h2>
                  Your bag <span>({cartCount})</span>
                </h2>
              </div>

              <button
                className="close-button"
                onClick={() => setBagOpen(false)}
                aria-label="Fechar sacola"
              >
                <X size={19} />
              </button>
            </div>

            {cart.length === 0 ? (
              <div className="empty-bag">
                <ShoppingBag size={32} strokeWidth={1.2} />
                <p>Your wardrobe is waiting.</p>
                <span>Escolha uma peça para começar.</span>

                <button onClick={() => setBagOpen(false)}>
                  CONTINUE EXPLORING
                  <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              <>
                <div className="cart-list">
                  {cart.map((item) => (
                    <div
                      className="cart-item"
                      key={`${item.product.id}-${item.size}`}
                    >
                      <div
                        className="cart-swatch"
                        style={{ backgroundColor: item.product.color }}
                      />

                      <div className="cart-item-info">
                        <strong>{item.product.name}</strong>
                        <span>SIZE {item.size}</span>

                        <small>
                          {formatMoney(item.product.price * item.quantity)}
                        </small>

                        <div className="quantity-control">
                          <button
                            className="quantity-button"
                            onClick={() =>
                              changeQuantity(item.product.id, item.size, -1)
                            }
                            aria-label={`Diminuir ${item.product.name}`}
                          >
                            <Minus size={13} />
                          </button>

                          <span>{item.quantity}</span>

                          <button
                            className="quantity-button"
                            onClick={() =>
                              changeQuantity(item.product.id, item.size, 1)
                            }
                            aria-label={`Aumentar ${item.product.name}`}
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      <button
                        className="remove-item"
                        onClick={() =>
                          removeCartItem(item.product.id, item.size)
                        }
                        aria-label={`Remover ${item.product.name}`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="cart-total">
                  <span>SUBTOTAL</span>
                  <strong>{formatMoney(cartTotal)}</strong>
                </div>

                <p className="modal-note">
                  A sacola fica salva neste navegador. Pagamento e checkout
                  ainda não estão integrados.
                </p>

                <button
                  className="checkout-button"
                  disabled
                  title="Checkout ainda não disponível"
                >
                  CHECKOUT — COMING SOON
                  <ArrowUpRight size={17} />
                </button>
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

export default App
