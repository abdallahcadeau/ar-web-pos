
import { useState, useEffect } from "react";
import "./index.css";
import { supabase } from "./lib/supabase";

function BrandLogo({ compact = false }) {
  return (
    <div className={`brand-logo ${compact ? "brand-logo-compact" : ""}`}>
      <div className="brand-mark" aria-label="AR WEB logo">
        <span>AR</span><i />
      </div>
      {!compact && (
        <div className="brand-copy">
          <strong>AR WEB</strong>
          <small>POINT OF SALE SYSTEM</small>
        </div>
      )}
    </div>
  );
}

const authInputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: "12px",
  margin: "8px 0 18px",
  border: "1px solid #CBD5E1",
  borderRadius: "8px",
  fontSize: "15px",
};

const authButtonStyle = {
  width: "100%",
  padding: "13px",
  background: "#0D6EFD",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  fontSize: "16px",
  cursor: "pointer",
};

function App() {
  // تسجيل الدخول
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const [authError, setAuthError] = useState("");
  // بيانات المحل
const [shop, setShop] = useState(null);
const [shopName, setShopName] = useState("");
const [shopLoading, setShopLoading] = useState(false);
const [shopBusy, setShopBusy] = useState(false);
const [shopError, setShopError] = useState("");

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;

      if (error) {
        setAuthError(error.message);
      }

      setSession(data?.session ?? null);
      setAuthReady(true);
    });
    

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

useEffect(() => {
  if (!authReady) return;

  if (!session?.user?.id) {
    setShop(null);
    
    setShopLoading(false);
    return;
  }

  let cancelled = false;

  async function loadShop() {
    setShopLoading(true);
    setShopError("");

    try {
      const { data: membership, error: membershipError } =
        await supabase
          .from("shop_memberships")
          .select("shop_id")
          .eq("user_id", session.user.id)
          .limit(1)
          .maybeSingle();

     console.log("USER ID:", session.user.id);
console.log("MEMBERSHIP DATA:", membership);
console.log("MEMBERSHIP ERROR:", membershipError);

if (membershipError) throw membershipError;

if (!membership) {
        if (!cancelled) setShop(null);
        return;
      }

      const { data: shopData, error: shopDataError } =
        await supabase
          .from("shops")
          .select("id, name")
          .eq("id", membership.shop_id)
          .single();

      if (shopDataError) throw shopDataError;

      if (!cancelled) setShop(shopData);
    } catch (error) {
      if (!cancelled) {
        setShopError(error.message || "حدث خطأ أثناء تحميل بيانات المحل");
      }
    } finally {
      if (!cancelled) setShopLoading(false);
    }
  }

  loadShop();

  return () => {
    cancelled = true;
  };
}, [session, authReady]);

useEffect(() => {
  if (!shop?.id) return;

  let cancelled = false;

  async function loadProducts() {
    setProductsLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!cancelled) {
        const mappedProducts = (data || []).map((item) => ({
          id: item.id,
          name: item.name,
          nameEn: item.name_en || "",
          barcode: item.barcode || "",
          price: Number(item.price),
          cost: Number(item.cost) || 0,
          quantity: Number(item.quantity),
        }));

        setProducts(mappedProducts);
        localStorage.removeItem("arweb_products");
      }
    } catch (error) {
      if (!cancelled) {
        alert("خطأ في تحميل المنتجات: " + error.message);
      }
    } finally {
      if (!cancelled) setProductsLoading(false);
    }
  }

  loadProducts();

  return () => {
    cancelled = true;
  };
}, [shop?.id]);
useEffect(() => {
  if (!shop?.id) return;

  let cancelled = false;

  async function loadSales() {
    setSalesLoading(true);

    try {
      const { data, error } = await supabase
        .from("sales")
        .select(`
          *,
          sale_items (*)
        `)
        .eq("shop_id", shop.id)
        .order("sold_at", { ascending: false });

      if (error) throw error;

      if (!cancelled) {
        const mappedSales = (data || []).map((sale) => {
          const items = (sale.sale_items || []).map((item) => ({
            id: item.product_id,
            name: item.product_name,
            nameEn: item.product_name_en || "",
            barcode: item.barcode || "",
            price: Number(item.unit_price),
            cost: Number(item.unit_cost) || 0,
            quantity: Number(item.quantity),
          }));

          const profit =
            items.reduce(
              (sum, item) =>
                sum +
                (item.price - item.cost) * item.quantity,
              0
            ) - Number(sale.discount || 0);

          return {
            id: sale.invoice_number,
            date: sale.sold_at,
            items,
            subtotal: Number(sale.subtotal),
            discount: Number(sale.discount),
            total: Number(sale.total),
            profit,
            paymentMethod: sale.payment_method,
          };
        });

        setSales((oldSales) => {
          const merged = [...mappedSales];

          oldSales.forEach((oldSale) => {
            const exists = merged.some(
              (sale) => sale.id === oldSale.id
            );

            if (!exists) {
              merged.push(oldSale);
            }
          });

          return merged;
        });
      }
    } catch (error) {
      if (!cancelled) {
        console.error("Load sales error:", error);
        alert("خطأ في تحميل الفواتير: " + error.message);
      }
    } finally {
      if (!cancelled) setSalesLoading(false);
    }
  }

  loadSales();

  return () => {
    cancelled = true;
  };
}, [shop?.id]);


  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    setAuthMessage("");

    try {
      if (authMode === "signup") {
       const { data, error } = await supabase.auth.signInWithPassword({
  email: authEmail.trim(),
  password: authPassword,
});

if (error) throw error;
console.log("LOGIN SESSION:", !!data.session);
console.log("LOGIN USER:", data.user?.email);
console.log("STORAGE:", !!localStorage.getItem(
  "sb-uzchuspimfyjpikrjper-auth-token"
));

if (!data.session) {
  throw new Error("تم تسجيل الدخول ولكن لم يتم إنشاء جلسة.");
}

setSession(data.session);
setAuthReady(true);

console.log("تم تسجيل الدخول والجلسة موجودة:", !!data.session);
        if (!data.session) {
          setAuthMessage(
            "تم إنشاء الحساب. راجع بريدك الإلكتروني لتأكيد الحساب."
          );
        } else {
          setAuthMessage("تم إنشاء الحساب بنجاح.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword,
        });

        if (error) throw error;
      }
    } catch (error) {
      setAuthError(error.message || "حدث خطأ، حاول مرة أخرى.");
    } finally {
      setAuthBusy(false);
    }
  };

 

const handleLogout = async () => {
  try {
    const { error } = await supabase.auth.signOut({
      scope: "local"
    });

    if (error) throw error;

    setShop(null);
    setShopError("");
    setShopLoading(false);
    setSession(null);
    setAuthError("");
    setAuthMessage("");
    setAuthReady(true);

  } catch (error) {
    alert("خطأ في تسجيل الخروج: " + error.message);
  }
};


const handleCreateShop = async (e) => {
  e.preventDefault();
  const { data: sessionData, error: sessionError } =
  await supabase.auth.getSession();

console.log("SESSION:", !!sessionData.session);
console.log("USER:", sessionData.session?.user?.email || "NO USER");
console.log("AUTH ERROR:", sessionError);
  if (!shopName.trim()) {
    setShopError("من فضلك اكتب اسم المحل");
    return;
  }

  setShopBusy(true);
  setShopError("");

  try {
    const { data, error } = await supabase.rpc("create_shop", {
      p_name: shopName.trim(),
    });

    if (error) throw error;
    if (!data) throw new Error("لم يتم استلام رقم المحل");

    setShop({
      id: data,
      name: shopName.trim(),
    });

    setShopName("");
  } catch (error) {
    setShopError(error.message || "حدث خطأ أثناء إنشاء المحل");
  } finally {
    setShopBusy(false);
  }
};


  // حالات البرنامج
  const [language, setLanguage] = useState("ar");
  const [page, setPage] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [lastSale, setLastSale] = useState(null);
  const [receiptSale, setReceiptSale] = useState(null);

  const [reportFrom, setReportFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [reportTo, setReportTo] = useState(
    new Date().toISOString().slice(0, 10)
  );

 const [products, setProducts] = useState([]);
 const [productsLoading, setProductsLoading] = useState(false);

useEffect(() => {
  if (!shop?.id) return;

  let cancelled = false;

  async function loadProducts() {
    setProductsLoading(true);

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("shop_id", shop.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!cancelled) {
        const mappedProducts = (data || []).map((item) => ({
          id: item.id,
          name: item.name,
          nameEn: item.name_en || "",
          barcode: item.barcode || "",
          price: Number(item.price),
          cost: Number(item.cost) || 0,
          quantity: Number(item.quantity),
        }));

        setProducts(mappedProducts);

        // حذف النسخة المحلية القديمة بعد نجاح التحميل
        localStorage.removeItem("arweb_products");
      }
    } catch (error) {
      if (!cancelled) {
        alert("خطأ في تحميل المنتجات: " + error.message);
      }
    } finally {
      if (!cancelled) setProductsLoading(false);
    }
  }

  loadProducts();

  return () => {
    cancelled = true;
  };
}, [shop?.id]);


  const [sales, setSales] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("arweb_sales"));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
const [salesLoading, setSalesLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    nameEn: "",
    barcode: "",
    price: "",
    cost: "",
    quantity: "",
  });

  const ar = language === "ar";

  const t = {
    dashboard: ar ? "لوحة التحكم" : "Dashboard",
    products: ar ? "المنتجات" : "Products",
    sales: ar ? "المبيعات" : "Sales",
    inventory: ar ? "المخزون" : "Inventory",
    reports: ar ? "التقارير" : "Reports",
    settings: ar ? "الإعدادات" : "Settings",
    welcome: ar ? "مرحباً بك في AR WEB POS" : "Welcome to AR WEB POS",
    manage: ar ? "إدارة المنتجات" : "Product Management",
    add: ar ? "إضافة منتج جديد +" : "Add New Product +",
    name: ar ? "اسم المنتج بالعربي" : "Arabic Product Name",
    nameEn: ar ? "اسم المنتج بالإنجليزي" : "English Product Name",
    barcode: ar ? "الباركود" : "Barcode",
    price: ar ? "سعر البيع" : "Selling Price",
    cost: ar ? "سعر التكلفة" : "Cost Price",
    quantity: ar ? "الكمية" : "Quantity",
    save: ar ? "حفظ المنتج" : "Save Product",
    cancel: ar ? "إلغاء" : "Cancel",
    edit: ar ? "تعديل" : "Edit",
    delete: ar ? "حذف" : "Delete",
    search: ar ? "ابحث عن منتج..." : "Search products...",
    product: ar ? "المنتج" : "Product",
    actions: ar ? "الإجراءات" : "Actions",
    total: ar ? "عدد المنتجات" : "Total Products",
    stock: ar ? "إجمالي المخزون" : "Total Stock",
    value: ar ? "قيمة المخزون بالتكلفة" : "Stock Cost Value",
    noProducts: ar ? "لا توجد منتجات حتى الآن" : "No products yet",
    required: ar
      ? "من فضلك أدخل اسم المنتج وسعر بيع صحيح والكمية"
      : "Enter a product name, valid selling price and quantity",
    confirm: ar
      ? "هل أنت متأكد من حذف المنتج؟"
      : "Are you sure you want to delete this product?",
    emptySearch: ar ? "لا توجد نتائج للبحث" : "No search results",
    currency: ar ? "جنيه" : "EGP",
    mainMenu: ar ? "القائمة الرئيسية" : "MAIN MENU",
    administrator: ar ? "مدير النظام" : "Administrator",
    footer: "© 2026 AR WEB POS — All Rights Reserved",
    checkout: ar ? "شاشة الكاشير" : "Checkout",
    catalog: ar ? "المنتجات المتاحة" : "Available Products",
    cart: ar ? "سلة المشتريات" : "Shopping Cart",
    subtotal: ar ? "الإجمالي" : "Subtotal",
    discount: ar ? "الخصم" : "Discount",
    grandTotal: ar ? "المبلغ المطلوب" : "Amount Due",
    payment: ar ? "طريقة الدفع" : "Payment Method",
    cash: ar ? "نقدي" : "Cash",
    card: ar ? "بطاقة" : "Card",
    complete: ar
      ? "تأكيد البيع وطباعة الفاتورة"
      : "Complete Sale & Print Receipt",
    clearCart: ar ? "إفراغ السلة" : "Clear Cart",
    emptyCart: ar
      ? "السلة فارغة، أضف منتجات للبدء"
      : "Cart is empty. Add products to begin.",
    insufficient: ar
      ? "الكمية المطلوبة غير متاحة في المخزون"
      : "Requested quantity is not available in stock",
    saleDone: ar ? "تم تسجيل البيع بنجاح" : "Sale completed successfully",
    invoice: ar ? "فاتورة بيع" : "Sales Receipt",
    date: ar ? "التاريخ" : "Date",
    method: ar ? "طريقة الدفع" : "Payment",
    close: ar ? "إغلاق" : "Close",
    salesHistory: ar ? "سجل المبيعات" : "Sales History",
    noSales: ar
      ? "لا توجد مبيعات مسجلة حتى الآن"
      : "No sales recorded yet",
    items: ar ? "الصنف" : "Item",
    qty: ar ? "العدد" : "Qty",
    lineTotal: ar ? "الإجمالي" : "Total",
    lowStock: ar ? "المخزون المتاح" : "Available stock",
    reportTitle: ar
      ? "تقارير المبيعات والأرباح"
      : "Sales & Profit Reports",
    from: ar ? "من تاريخ" : "From date",
    to: ar ? "إلى تاريخ" : "To date",
    revenue: ar ? "إجمالي المبيعات" : "Total Revenue",
    profit: ar ? "الربح التقديري" : "Estimated Profit",
    transactions: ar ? "عدد الفواتير" : "Transactions",
    soldUnits: ar ? "الوحدات المباعة" : "Units Sold",
    bestSellers: ar ? "الأكثر مبيعًا" : "Best Sellers",
    lowStockProducts: ar
      ? "منتجات قاربت على النفاد"
      : "Low Stock Products",
    noReportData: ar
      ? "لا توجد مبيعات في الفترة المحددة"
      : "No sales in the selected period",
    profitUnavailable: ar
      ? "بيانات تكلفة غير متاحة لبعض الفواتير القديمة"
      : "Cost data is unavailable for some older sales",
    estimated: ar ? "تقديري" : "Estimated",
  };

  // حفظ البيانات محليًا


  useEffect(() => {
    localStorage.setItem("arweb_sales", JSON.stringify(sales));
  }, [sales]);

  const money = (value) => {
    const amount = Number(value) || 0;

    return `${new Intl.NumberFormat(ar ? "ar-EG" : "en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount)} ${t.currency}`;
  };

  function resetForm() {
    setForm({
      name: "",
      nameEn: "",
      barcode: "",
      price: "",
      cost: "",
      quantity: "",
    });
    setEditingId(null);
    setShowForm(false);
  }

async function saveProduct(e) {
  e.preventDefault();

  if (
    !form.name.trim() ||
    form.price === "" ||
    !Number.isFinite(Number(form.price)) ||
    Number(form.price) <= 0 ||
    form.quantity === "" ||
    !Number.isFinite(Number(form.quantity)) ||
    Number(form.quantity) < 0
  ) {
    alert(t.required);
    return;
  }

console.log("بيانات المحل وقت الحفظ:", shop);

if (!shop?.id) {
  alert("المحل غير متاح. افتح Console وابعتلي النتيجة.");
  return;
}

  const productData = {
    shop_id: shop.id,
    name: form.name.trim(),
    name_en: form.nameEn.trim(),
    barcode: form.barcode.trim(),
    price: Number(form.price),
    cost: Number(form.cost) || 0,
    quantity: Number(form.quantity),
  };

  try {
    let result;

    if (editingId) {
      result = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingId)
        .eq("shop_id", shop.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("products")
        .insert(productData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    const saved = {
      id: result.data.id,
      name: result.data.name,
      nameEn: result.data.name_en || "",
      barcode: result.data.barcode || "",
      price: Number(result.data.price),
      cost: Number(result.data.cost) || 0,
      quantity: Number(result.data.quantity),
    };

    if (editingId) {
      setProducts((old) =>
        old.map((item) => item.id === editingId ? saved : item)
      );
    } else {
      setProducts((old) => [...old, saved]);
    }

    resetForm();
  } catch (error) {
    alert("حدث خطأ أثناء حفظ المنتج: " + error.message);
  }
}


  function editProduct(product) {
    setForm({
      name: product.name || "",
      nameEn: product.nameEn || "",
      barcode: product.barcode || "",
      price: String(product.price ?? ""),
      cost: String(product.cost ?? ""),
      quantity: String(product.quantity ?? ""),
    });

    setEditingId(product.id);
    setShowForm(true);
    setPage("products");
  }

  function deleteProduct(id) {
    if (window.confirm(t.confirm)) {
      setProducts((old) => old.filter((item) => item.id !== id));
    }
  }

  function addToCart(product) {
    if (Number(product.quantity) <= 0) {
      alert(t.insufficient);
      return;
    }

    setCart((old) => {
      const found = old.find((item) => item.id === product.id);

      if (found) {
        if (found.quantity >= Number(product.quantity)) {
          alert(t.insufficient);
          return old;
        }

        return old.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [
        ...old,
        {
          id: product.id,
          name: product.name,
          nameEn: product.nameEn,
          price: Number(product.price),
          cost: Number(product.cost) || 0,
          quantity: 1,
        },
      ];
    });
  }

  function changeCartQuantity(id, delta) {
    const product = products.find((item) => item.id === id);

    setCart((old) =>
      old
        .map((item) => {
          if (item.id !== id) return item;

          const next = item.quantity + delta;

          if (next > Number(product?.quantity || 0)) {
            alert(t.insufficient);
            return item;
          }

          return { ...item, quantity: next };
        })
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(id) {
    setCart((old) => old.filter((item) => item.id !== id));
  }

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  const discountValue = Math.min(
    subtotal,
    Math.max(0, Number(discount) || 0)
  );

  const total = Math.max(0, subtotal - discountValue);

async function completeSale() {
  if (!cart.length) return;

  if (!shop?.id) {
    alert("لم يتم تحديد المحل الحالي");
    return;
  }

  const unavailable = cart.some((cartItem) => {
    const product = products.find(
      (item) => item.id === cartItem.id
    );

    return !product ||
      Number(product.quantity) < Number(cartItem.quantity);
  });

  if (unavailable) {
    alert(t.insufficient);
    return;
  }

  const sale = {
    id: `AR-${Date.now()}`,
    date: new Date().toISOString(),
    items: cart.map((item) => ({
      ...item,
      cost: Number(item.cost) || 0,
    })),
    subtotal,
    discount: discountValue,
    total,
    profit:
      cart.reduce(
        (sum, item) =>
          sum +
          (Number(item.price) - (Number(item.cost) || 0)) *
            Number(item.quantity),
        0
      ) - discountValue,
    paymentMethod,
  };

  try {
    const { data: saleId, error } = await supabase.rpc(
      "complete_sale",
      {
        p_shop_id: shop.id,
        p_invoice_number: sale.id,
        p_sold_at: sale.date,
        p_subtotal: sale.subtotal,
        p_discount: sale.discount,
        p_total: sale.total,
        p_payment_method: sale.paymentMethod,
        p_items: sale.items.map((item) => ({
          id: item.id,
          name: item.name,
          nameEn: item.nameEn || "",
          barcode: item.barcode || "",
          price: Number(item.price),
          cost: Number(item.cost) || 0,
          quantity: Number(item.quantity),
        })),
      }
    );

    if (error) throw error;

    if (!saleId) {
      throw new Error("لم يتم حفظ الفاتورة");
    }

    setProducts((old) =>
      old.map((product) => {
        const sold = sale.items.find(
          (item) => item.id === product.id
        );

        return sold
          ? {
              ...product,
              quantity:
                Number(product.quantity) - Number(sold.quantity),
            }
          : product;
      })
    );

    setSales((old) => [sale, ...old]);
    setLastSale(sale);
    setReceiptSale(sale);
    setCart([]);
    setDiscount("0");

    alert(t.saleDone);
    setTimeout(() => window.print(), 250);

  } catch (error) {
    console.error("Complete sale error:", error);
    alert("حدث خطأ أثناء حفظ الفاتورة: " + error.message);
  }
}


  // الحسابات والتقارير
  const query = search.trim().toLocaleLowerCase();

  const filteredProducts = products.filter(
    (product) =>
      (product.name || "").toLocaleLowerCase().includes(query) ||
      (product.nameEn || "").toLocaleLowerCase().includes(query) ||
      (product.barcode || "").toLocaleLowerCase().includes(query)
  );

  const totalStock = products.reduce(
    (sum, product) => sum + (Number(product.quantity) || 0),
    0
  );

  const stockValue = products.reduce(
    (sum, product) =>
      sum +
      (Number(product.cost) || 0) * (Number(product.quantity) || 0),
    0
  );

  const menu = [
    { id: "dashboard", icon: "▦", label: t.dashboard },
    { id: "sales", icon: "🛒", label: t.sales },
    { id: "products", icon: "📦", label: t.products },
    { id: "inventory", icon: "▤", label: t.inventory },
    { id: "reports", icon: "▥", label: t.reports },
    { id: "settings", icon: "⚙", label: t.settings },
  ];

  const isProductPage =
    page === "products" || page === "inventory";

  const reportSales = sales.filter((sale) => {
    const day = new Date(sale.date).toISOString().slice(0, 10);
    return day >= reportFrom && day <= reportTo;
  });

  const reportRevenue = reportSales.reduce(
    (sum, sale) => sum + (Number(sale.total) || 0),
    0
  );

  const reportUnits = reportSales.reduce(
    (sum, sale) =>
      sum +
      (sale.items || []).reduce(
        (n, item) => n + (Number(item.quantity) || 0),
        0
      ),
    0
  );

  const reportProfitSales = reportSales.filter(
    (sale) => typeof sale.profit === "number"
  );

  const reportProfit = reportProfitSales.reduce(
    (sum, sale) => sum + sale.profit,
    0
  );

  const hasOldSalesWithoutCost =
    reportProfitSales.length !== reportSales.length;

  const bestSellerMap = {};

  reportSales.forEach((sale) =>
    (sale.items || []).forEach((item) => {
      const key = item.id;

      if (!bestSellerMap[key]) {
        bestSellerMap[key] = {
          name: ar ? item.name : item.nameEn || item.name,
          quantity: 0,
          revenue: 0,
        };
      }

      bestSellerMap[key].quantity += Number(item.quantity) || 0;
      bestSellerMap[key].revenue +=
        (Number(item.price) || 0) * (Number(item.quantity) || 0);
    })
  );

  const bestSellers = Object.values(bestSellerMap)
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const lowStockProducts = products
    .filter((product) => Number(product.quantity) <= 5)
    .sort(
      (a, b) => Number(a.quantity) - Number(b.quantity)
    );

  // شاشة الانتظار
  if (!authReady) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          fontFamily: "Cairo, sans-serif",
        }}
      >
        جاري الاتصال...
      </div>
    );
  }

  // شاشة تسجيل الدخول وإنشاء الحساب
  
if (!session) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#F1F5F9",
      padding: "20px",
      fontFamily: "Cairo, sans-serif",
      direction: "rtl"
    }}>
      <form
        onSubmit={handleAuth}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "#fff",
          padding: "30px",
          borderRadius: "18px",
          boxShadow: "0 10px 35px rgba(0,0,0,0.08)"
        }}
      >
        <h1 style={{ color: "#0D6EFD", textAlign: "center" }}>
          AR WEB
        </h1>

        <h2 style={{ textAlign: "center" }}>
          {authMode === "login" ? "تسجيل الدخول" : "إنشاء حساب جديد"}
        </h2>

        <label>البريد الإلكتروني</label>
        <input
          type="email"
          value={authEmail}
          onChange={(e) => setAuthEmail(e.target.value)}
          placeholder="example@email.com"
          required
          style={authInputStyle}
        />

        <label>كلمة المرور</label>
        <input
          type="password"
          value={authPassword}
          onChange={(e) => setAuthPassword(e.target.value)}
          placeholder="كلمة المرور"
          required
          minLength={6}
          style={authInputStyle}
        />

        {authError && (
          <p style={{ color: "#EF4444" }}>{authError}</p>
        )}

        {authMessage && (
          <p style={{ color: "#10B981" }}>{authMessage}</p>
        )}

        <button
          type="submit"
          disabled={authBusy}
          style={{
            ...authButtonStyle,
            opacity: authBusy ? 0.7 : 1
          }}
        >
          {authBusy
            ? "جاري التنفيذ..."
            : authMode === "login" ? "دخول" : "إنشاء الحساب"}
        </button>

        <p style={{ textAlign: "center", marginTop: "20px" }}>
          {authMode === "login"
            ? "ليس لديك حساب؟"
            : "لديك حساب بالفعل؟"}

          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setAuthError("");
              setAuthMessage("");
            }}
            style={{
              border: "none",
              background: "none",
              color: "#0D6EFD",
              cursor: "pointer",
              fontWeight: "bold",
              marginRight: "5px"
            }}
          >
            {authMode === "login" ? "إنشاء حساب" : "تسجيل الدخول"}
          </button>
        </p>
      </form>
    </div>
  );
}


if (session && !shop && !shopLoading) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      fontFamily: "Cairo, sans-serif",
      direction: "rtl",
      padding: 20,
      background: "#F8FAFC"
    }}>
      <form
        onSubmit={handleCreateShop}
        style={{
          background: "#fff",
          padding: 30,
          borderRadius: 16,
          width: "100%",
          maxWidth: 400,
          boxShadow: "0 5px 25px rgba(0,0,0,0.08)"
        }}
      >
        <h2 style={{ color: "#0D6EFD" }}>مرحباً بك في AR WEB</h2>
        <p>اكتب اسم المحل لإنشاء مساحة العمل الخاصة بك.</p>

        <input
          type="text"
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="اسم المحل"
          required
          style={{
            width: "100%",
            padding: 12,
            marginBottom: 15,
            boxSizing: "border-box",
            border: "1px solid #CBD5E1",
            borderRadius: 8,
            fontFamily: "Cairo, sans-serif"
          }}
        />

        {shopError && (
          <p style={{ color: "#EF4444" }}>{shopError}</p>
        )}

        <button
          type="submit"
          disabled={shopBusy}
          style={{
            width: "100%",
            padding: 12,
            background: "#0D6EFD",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            cursor: "pointer",
            fontFamily: "Cairo, sans-serif"
          }}
        >
          {shopBusy ? "جاري إنشاء المحل..." : "إنشاء المحل"}
        </button>

        <button
          type="button"
          onClick={handleLogout}
          style={{ marginTop: 12 }}
        >
          تسجيل الخروج
        </button>
      </form>
    </div>
  );
}

if (session && shopLoading) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      fontFamily: "Cairo, sans-serif",
      direction: "rtl"
    }}>
      جاري تحميل بيانات المحل...
    </div>
  );
}

if (session && shopError && !shop) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      fontFamily: "Cairo, sans-serif",
      direction: "rtl",
      padding: 20
    }}>
      <div style={{ textAlign: "center" }}>
        <h2>حصلت مشكلة في تحميل المحل</h2>
        <p>{shopError}</p>

        <button onClick={() => {
          setShopError("");
          setShopLoading(true);
        }}>
          إعادة المحاولة
        </button>

        <button onClick={handleLogout}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}

  // الواجهة الرئيسية
  return (
    <div className="app" dir={ar ? "rtl" : "ltr"} lang={ar ? "ar" : "en"}>
      <aside className="sidebar">
        <div className="logo">
          <BrandLogo />
        </div>

<div style={{
  padding: "12px 16px",
  color: "#64748B",
  borderBottom: "1px solid #E2E8F0",
  marginBottom: "10px"
}}>
  <small>المحل الحالي</small>

  <strong style={{
    display: "block",
    color: "#0D6EFD",
    marginTop: "4px",
    fontSize: "15px"
  }}>
    {shop?.name}
  </strong>
</div>

        <div className="menu-title">{t.mainMenu}</div>

        <nav aria-label={t.mainMenu}>
          {menu.map((item) => (
            <button
              key={item.id}
              className={`menu-item ${
                page === item.id ? "active" : ""
              }`}
              onClick={() => {
                setPage(item.id);
                setShowForm(false);
                setSearch("");
              }}
              type="button"
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar">AR</div>
          <div>
            <strong>{session.user?.email || "Admin"}</strong>
            <small>{t.administrator}</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">
            <span aria-hidden="true">⌕</span>
            <input
              aria-label={t.search}
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <button
            className="language-btn"
            onClick={() => setLanguage(ar ? "en" : "ar")}
            type="button"
          >
            🌐 {ar ? "English" : "العربية"}
          </button>

          <button
            className="language-btn"
            onClick={handleLogout}
            type="button"
            disabled={authBusy}
          >
            {ar ? "تسجيل الخروج" : "Sign out"}
          </button>
        </header>

        <section className="content">
          {page === "sales" ? (
            <div className="pos-page">
              <div className="page-heading">
                <div>
                  <h1>{t.checkout}</h1>
                  <p>{t.welcome}</p>
                </div>
                <span className="date-label">
                  {new Date().toLocaleDateString(
                    ar ? "ar-EG" : "en-US"
                  )}
                </span>
              </div>

              <div className="pos-layout">
                <div className="table-card pos-products">
                  <div className="table-heading">
                    <h3>{t.catalog}</h3>
                    <span>{filteredProducts.length}</span>
                  </div>

                  <div className="pos-product-grid">
                    {filteredProducts.map((product) => (
                      <button
                        className="pos-product-card"
                        key={product.id}
                        type="button"
                        onClick={() => addToCart(product)}
                        disabled={Number(product.quantity) <= 0}
                      >
                        <span className="pos-product-icon">📦</span>
                        <strong>
                          {ar
                            ? product.name
                            : product.nameEn || product.name}
                        </strong>
                        <b>{money(product.price)}</b>
                        <small>
                          {t.lowStock}: {product.quantity}
                        </small>
                      </button>
                    ))}

                    {filteredProducts.length === 0 && (
                      <div className="empty-state">
                        {t.noProducts}
                      </div>
                    )}
                  </div>
                </div>

                <div className="table-card pos-cart">
                  <div className="table-heading">
                    <h3>{t.cart}</h3>
                    <button
                      className="view-btn"
                      type="button"
                      onClick={() => setCart([])}
                    >
                      {t.clearCart}
                    </button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="empty-state">{t.emptyCart}</div>
                  ) : (
                    <div className="cart-items">
                      {cart.map((item) => (
                        <div className="cart-row" key={item.id}>
                          <div className="cart-item-info">
                            <strong>
                              {ar
                                ? item.name
                                : item.nameEn || item.name}
                            </strong>
                            <small>
                              {money(item.price)} × {item.quantity}
                            </small>
                          </div>

                          <div className="cart-controls">
                            <button
                              type="button"
                              onClick={() =>
                                changeCartQuantity(item.id, -1)
                              }
                              aria-label="Decrease"
                            >
                              −
                            </button>

                            <b>{item.quantity}</b>

                            <button
                              type="button"
                              onClick={() =>
                                changeCartQuantity(item.id, 1)
                              }
                              aria-label="Increase"
                            >
                              +
                            </button>

                            <button
                              className="cart-remove"
                              type="button"
                              onClick={() => removeFromCart(item.id)}
                              aria-label="Remove"
                            >
                              ×
                            </button>
                          </div>

                          <strong>
                            {money(item.price * item.quantity)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="checkout-summary">
                    <div>
                      <span>{t.subtotal}</span>
                      <strong>{money(subtotal)}</strong>
                    </div>

                    <label className="discount-field">
                      <span>{t.discount}</span>
                      <input
                        type="number"
                        min="0"
                        max={subtotal}
                        step="0.01"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                      />
                    </label>

                    <div className="grand-total">
                      <span>{t.grandTotal}</span>
                      <strong>{money(total)}</strong>
                    </div>

                    <label className="payment-field">
                      <span>{t.payment}</span>
                      <select
                        value={paymentMethod}
                        onChange={(e) =>
                          setPaymentMethod(e.target.value)
                        }
                      >
                        <option value="cash">{t.cash}</option>
                        <option value="card">{t.card}</option>
                      </select>
                    </label>

                    <button
                      className="primary-btn checkout-btn"
                      type="button"
                      disabled={!cart.length}
                      onClick={completeSale}
                    >
                      {t.complete}
                    </button>
                  </div>
                </div>
              </div>

              <div className="table-card sales-history">
                <div className="table-heading">
                  <h3>{t.salesHistory}</h3>
                  <span>{sales.length}</span>
                </div>

                {sales.length === 0 ? (
                  <div className="empty-state">{t.noSales}</div>
                ) : (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t.date}</th>
                          <th>{t.payment}</th>
                          <th>{t.grandTotal}</th>
                          <th>{t.actions}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {sales.slice(0, 10).map((sale) => (
                          <tr key={sale.id}>
                            <td>{sale.id}</td>
                            <td>
                              {new Date(sale.date).toLocaleString(
                                ar ? "ar-EG" : "en-US"
                              )}
                            </td>
                            <td>
                              {sale.paymentMethod === "cash"
                                ? t.cash
                                : t.card}
                            </td>
                            <td>{money(sale.total)}</td>
                            <td>
                              <button
                                className="edit-btn"
                                type="button"
                                onClick={() => setReceiptSale(sale)}
                              >
                                {ar ? "عرض الفاتورة" : "View receipt"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : page === "reports" ? (
            <div className="reports-page">
              <div className="page-heading">
                <div>
                  <h1>{t.reportTitle}</h1>
                  <p>{t.welcome}</p>
                </div>

                <button
                  className="view-btn"
                  type="button"
                  onClick={() => window.print()}
                >
                  {ar ? "طباعة التقرير" : "Print Report"}
                </button>
              </div>

              <div className="report-filters">
                <label>
                  {t.from}
                  <input
                    type="date"
                    value={reportFrom}
                    onChange={(e) => setReportFrom(e.target.value)}
                  />
                </label>

                <label>
                  {t.to}
                  <input
                    type="date"
                    value={reportTo}
                    min={reportFrom}
                    onChange={(e) => setReportTo(e.target.value)}
                  />
                </label>
              </div>

              <div className="stats-grid report-stats">
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">💵</span>
                  </div>
                  <p>{t.revenue}</p>
                  <h2>{money(reportRevenue)}</h2>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">📈</span>
                    <span className="growth">{t.estimated}</span>
                  </div>
                  <p>{t.profit}</p>
                  <h2>{money(reportProfit)}</h2>
                  {hasOldSalesWithoutCost && (
                    <small className="report-note">
                      {t.profitUnavailable}
                    </small>
                  )}
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">🧾</span>
                  </div>
                  <p>{t.transactions}</p>
                  <h2>{reportSales.length}</h2>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">📦</span>
                  </div>
                  <p>{t.soldUnits}</p>
                  <h2>{reportUnits}</h2>
                </div>
              </div>

              <div className="report-columns">
                <div className="table-card">
                  <div className="table-heading">
                    <h3>{t.bestSellers}</h3>
                  </div>

                  {bestSellers.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t.product}</th>
                            <th>{t.qty}</th>
                            <th>{t.revenue}</th>
                          </tr>
                        </thead>

                        <tbody>
                          {bestSellers.map((item, index) => (
                            <tr key={`${item.name}-${index}`}>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>{money(item.revenue)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">{t.noReportData}</div>
                  )}
                </div>

                <div className="table-card">
                  <div className="table-heading">
                    <h3>{t.lowStockProducts}</h3>
                  </div>

                  {lowStockProducts.length ? (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>{t.product}</th>
                            <th>{t.quantity}</th>
                          </tr>
                        </thead>

                        <tbody>
                          {lowStockProducts.map((product) => (
                            <tr key={product.id}>
                              <td>
                                {ar
                                  ? product.name
                                  : product.nameEn || product.name}
                              </td>
                              <td>
                                <span className="pending">
                                  {product.quantity}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="empty-state">
                      {ar
                        ? "لا توجد منتجات منخفضة المخزون"
                        : "No low-stock products"}
                    </div>
                  )}
                </div>
              </div>

              <div className="table-card report-invoices">
                <div className="table-heading">
                  <h3>{t.salesHistory}</h3>
                  <span>{reportSales.length}</span>
                </div>

                {reportSales.length ? (
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>{t.date}</th>
                          <th>{t.payment}</th>
                          <th>{t.grandTotal}</th>
                          <th>{t.profit}</th>
                          <th>{t.actions}</th>
                        </tr>
                      </thead>

                      <tbody>
                        {reportSales.map((sale) => (
                          <tr key={sale.id}>
                            <td>{sale.id}</td>
                            <td>
                              {new Date(sale.date).toLocaleString(
                                ar ? "ar-EG" : "en-US"
                              )}
                            </td>
                            <td>
                              {sale.paymentMethod === "cash"
                                ? t.cash
                                : t.card}
                            </td>
                            <td>{money(sale.total)}</td>
                            <td>
                              {typeof sale.profit === "number"
                                ? money(sale.profit)
                                : "—"}
                            </td>
                            <td>
                              <button
                                className="edit-btn"
                                type="button"
                                onClick={() => setReceiptSale(sale)}
                              >
                                {ar ? "عرض الفاتورة" : "View receipt"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state">{t.noReportData}</div>
                )}
              </div>
            </div>
          ) : isProductPage ? (
            <>
              <div className="page-heading">
                <div>
                  <h1>{t.manage}</h1>
                  <p>{t.welcome}</p>
                </div>

                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                >
                  {t.add}
                </button>
              </div>

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">📦</span>
                  </div>
                  <p>{t.total}</p>
                  <h2>{products.length}</h2>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">🔢</span>
                  </div>
                  <p>{t.stock}</p>
                  <h2>
                    {totalStock.toLocaleString(
                      ar ? "ar-EG" : "en-US"
                    )}
                  </h2>
                </div>

                <div className="stat-card">
                  <div className="stat-top">
                    <span className="stat-icon">💰</span>
                  </div>
                  <p>{t.value}</p>
                  <h2>{money(stockValue)}</h2>
                </div>
              </div>

              {showForm && (
                <div className="form-card">
                  <h3>
                    {editingId
                      ? ar
                        ? "تعديل المنتج"
                        : "Edit Product"
                      : t.add}
                  </h3>

                  <form onSubmit={saveProduct}>
                    <div className="form-grid">
                      <label>
                        {t.name} *
                        <input
                          required
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          placeholder={
                            ar
                              ? "مثال: مياه معدنية"
                              : "Example: Mineral Water"
                          }
                        />
                      </label>

                      <label>
                        {t.nameEn}
                        <input
                          value={form.nameEn}
                          onChange={(e) =>
                            setForm({ ...form, nameEn: e.target.value })
                          }
                          placeholder="Example: Mineral Water"
                        />
                      </label>

                      <label>
                        {t.barcode}
                        <input
                          value={form.barcode}
                          onChange={(e) =>
                            setForm({ ...form, barcode: e.target.value })
                          }
                          placeholder="123456789"
                        />
                      </label>

                      <label>
                        {t.price} *
                        <input
                          required
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={form.price}
                          onChange={(e) =>
                            setForm({ ...form, price: e.target.value })
                          }
                        />
                      </label>

                      <label>
                        {t.cost}
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.cost}
                          onChange={(e) =>
                            setForm({ ...form, cost: e.target.value })
                          }
                        />
                      </label>

                      <label>
                        {t.quantity} *
                        <input
                          required
                          type="number"
                          min="0"
                          step="1"
                          value={form.quantity}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              quantity: e.target.value,
                            })
                          }
                        />
                      </label>
                    </div>

                    <div className="form-actions">
                      <button className="primary-btn" type="submit">
                        {t.save}
                      </button>

                      <button
                        className="cancel-btn"
                        type="button"
                        onClick={resetForm}
                      >
                        {t.cancel}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="table-card">
                <div className="table-heading">
                  <h3>{t.products}</h3>
                  <span>
                    {products.length} {t.products}
                  </span>
                </div>

                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t.product}</th>
                        <th>{t.barcode}</th>
                        <th>{t.price}</th>
                        <th>{t.cost}</th>
                        <th>{t.quantity}</th>
                        <th>{t.actions}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td>
                            <strong>
                              {ar
                                ? product.name
                                : product.nameEn || product.name}
                            </strong>
                          </td>

                          <td>{product.barcode || "—"}</td>
                          <td>{money(product.price)}</td>
                          <td>{money(product.cost)}</td>

                          <td>
                            <span
                              className={
                                Number(product.quantity) <= 5
                                  ? "pending"
                                  : "paid"
                              }
                            >
                              {product.quantity}
                            </span>
                          </td>

                          <td>
                            <div className="action-buttons">
                              <button
                                className="edit-btn"
                                type="button"
                                onClick={() => editProduct(product)}
                              >
                                {t.edit}
                              </button>

                              <button
                                className="delete-btn"
                                type="button"
                                onClick={() => deleteProduct(product.id)}
                              >
                                {t.delete}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}

                      {filteredProducts.length === 0 && (
                        <tr>
                          <td colSpan="6" className="empty-state">
                            {products.length === 0
                              ? t.noProducts
                              : t.emptySearch}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="welcome-card">
              <BrandLogo compact />
              <h1>{t.welcome}</h1>
              <p>
                {ar
                  ? "القسم ده لسه تحت التطوير. تقدر تبدأ بإدارة المنتجات أو فتح شاشة الكاشير."
                  : "This section is under development. You can manage products or open checkout."}
              </p>

              <div className="welcome-actions">
                <button
                  className="primary-btn"
                  type="button"
                  onClick={() => setPage("products")}
                >
                  {t.products}
                </button>

                <button
                  className="view-btn"
                  type="button"
                  onClick={() => setPage("sales")}
                >
                  {t.checkout}
                </button>
              </div>
            </div>
          )}

          <footer>{t.footer}</footer>
        </section>
      </main>

      {receiptSale && (
        <div
          className="receipt-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={t.invoice}
        >
          <div className="receipt-card" dir={ar ? "rtl" : "ltr"}>
         
<div className="receipt-brand">
  <BrandLogo />
</div>

<h3
  style={{
    margin: "10px 0",
    fontSize: "22px",
    fontWeight: "800",
    color: "#1E40AF",
  }}
>
  {shop?.name || ""}
</h3>

<h2>{t.invoice}</h2>

            <p>{receiptSale.id}</p>

            <p>
              {t.date}:{" "}
              {new Date(receiptSale.date).toLocaleString(
                ar ? "ar-EG" : "en-US"
              )}
            </p>

            <div className="receipt-lines">
              {receiptSale.items.map((item) => (
                <div className="receipt-line" key={item.id}>
                  <span>
                    {ar
                      ? item.name
                      : item.nameEn || item.name}{" "}
                    × {item.quantity}
                  </span>

                  <strong>
                    {money(item.price * item.quantity)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="receipt-line">
              <span>{t.subtotal}</span>
              <strong>{money(receiptSale.subtotal)}</strong>
            </div>

            <div className="receipt-line">
              <span>{t.discount}</span>
              <strong>{money(receiptSale.discount)}</strong>
            </div>

            <div className="receipt-line receipt-grand">
              <span>{t.grandTotal}</span>
              <strong>{money(receiptSale.total)}</strong>
            </div>

            <p>
              {t.method}:{" "}
              {receiptSale.paymentMethod === "cash"
                ? t.cash
                : t.card}
            </p>

            <div className="receipt-actions no-print">
              <button
                className="primary-btn"
                type="button"
                onClick={() => window.print()}
              >
                {ar ? "طباعة" : "Print"}
              </button>

              <button
                className="cancel-btn"
                type="button"
                onClick={() => setReceiptSale(null)}
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
