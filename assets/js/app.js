/**
 * Bashayer Elnakhel - Unified Application Script
 * This file combines authentication, data services, and page-specific logic.
 */

// 1. Tailwind Configuration (Must be global)
if (typeof tailwind !== "undefined") {
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: {
            green: "#378B47",
            greenHover: "#2d723a",
            greenLight: "#eaf4eb",
            gold: "#8B6F47",
            goldHover: "#7B5D38",
            goldLight: "#f8f4ec",
            cream: "#FBF9F5",
          },
        },
      },
    },
  };
}

// 2. Session Manager (Authentication Logic)
class SessionManager {
  static checkAuth() {
    const protectedPages = [
      "services.html",
      "admin_sectors.html",
      "admin_dashboard.html",
      "accounts_sectors.html",
      "accounts_dashboard.html",
    ];
    const path = window.location.pathname;
    // Get filename from the end of the path (works on both local and GitHub Pages)
    const currentPage = path.split("/").filter(p => p).pop() || "index.html";

    // Check if we are on a protected page
    const isProtected = protectedPages.includes(currentPage);

    if (isProtected) {
      if (localStorage.getItem("bashayer_logged_in") !== "true") {
        window.location.replace("index.html");
      }
    }
  }

  static logout() {
    localStorage.removeItem("bashayer_logged_in");
    window.location.replace("index.html");
  }
}

// Global instances and bindings
window.SessionManager = SessionManager;
window.logout = () => SessionManager.logout();

// Execute auth check immediately to prevent page flicker
SessionManager.checkAuth();

// 3. Data Service (Storage & Cloud Sync)
class DataService {
  constructor() {
    this.firebaseConfig = {
      apiKey: "AIzaSyBcN1nysCCjtlNfKlj0S1fawTcuI7v0Fjo",
      authDomain: "bashayerelnakhel-8eba4.firebaseapp.com",
      databaseURL: "https://bashayerelnakhel-8eba4-default-rtdb.firebaseio.com",
      projectId: "bashayerelnakhel-8eba4",
      storageBucket: "bashayerelnakhel-8eba4.firebasestorage.app",
      messagingSenderId: "891392478346",
      appId: "1:891392478346:web:999001a6a3eca21939f173",
      measurementId: "G-7SX98KSELB",
    };

    this.isFirebaseEnabled = false;
    this.db = null;
    this.initFirebase();
  }

  async initFirebase() {
    if (this.isFirebaseEnabled) return;
    if (this.firebaseConfig.databaseURL && typeof firebase !== "undefined") {
      try {
        if (!firebase.apps.length) {
          firebase.initializeApp(this.firebaseConfig);
        }
        this.db = firebase.database();
        this.isFirebaseEnabled = true;
        console.log("Firebase Sync Enabled");
      } catch (error) {
        console.error("Firebase Init Error:", error);
      }
    }
  }

  /**
   * Subscribe to real-time updates for a specific sector
   */
  async subscribeToSector(sectorId, callback) {
    await this.initFirebase();
    const localKey = `bashayer_sector_${sectorId}`;

    // Initial data from local storage for fast loading
    const cached = JSON.parse(localStorage.getItem(localKey));
    if (cached && callback) callback(cached);

    if (this.isFirebaseEnabled) {
      this.db.ref(`sectors/${sectorId}`).on("value", (snapshot) => {
        const data = snapshot.val();
        if (data) {
          localStorage.setItem(localKey, JSON.stringify(data));
          if (callback) callback(data);
        } else {
          // Initialize with defaults if empty in cloud
          const defaults = {
            name: this.getDefaultSectorName(sectorId),
            clients: this.getDefaultClients(),
          };
          this.saveSectorData(sectorId, defaults);
          if (callback) callback(defaults);
        }
      });
    }
  }

  async subscribeToAllSectors(callback) {
    await this.initFirebase();
    if (this.isFirebaseEnabled) {
      this.db.ref("sectors").on("value", (snapshot) => {
        const data = snapshot.val() || {};
        callback(data);
      }, (error) => {
        console.error("Firebase read error in subscribeToAllSectors:", error);
        callback({});
      });
    } else {
      callback({});
    }
  }

  async saveSectorData(sectorId, data) {
    const localKey = `bashayer_sector_${sectorId}`;
    localStorage.setItem(localKey, JSON.stringify(data));

    if (this.isFirebaseEnabled) {
      try {
        await this.db.ref(`sectors/${sectorId}`).set(data);
      } catch (error) {
        console.error("Cloud Save Error:", error);
      }
    }
  }

  async updateSectorName(sectorId, newName) {
    if (this.isFirebaseEnabled) {
      await this.db.ref(`sectors/${sectorId}/name`).set(newName);
    } else {
      const data = JSON.parse(
        localStorage.getItem(`bashayer_sector_${sectorId}`),
      ) || { clients: [] };
      data.name = newName;
      localStorage.setItem(`bashayer_sector_${sectorId}`, JSON.stringify(data));
    }
  }

  getDefaultSectorName(id) {
    const names = [
      "الأول",
      "الثاني",
      "الثالث",
      "الرابع",
      "الخامس",
      "السادس",
      "السابع",
      "الثامن",
      "التاسع",
      "العاشر",
    ];
    return names[id - 1] || id;
  }

  getDefaultClients() {
    return [];
  }

  async searchAllSectors(term) {
    const results = [];
    const normalizedTerm = term.toLowerCase().trim();
    if (!normalizedTerm) return results;

    await this.initFirebase();

    if (this.isFirebaseEnabled) {
      try {
        const snapshot = await this.db.ref("sectors").once("value");
        const sectors = snapshot.val() || {};
        for (let i = 1; i <= 10; i++) {
          const sectorData = sectors[i];
          const clients = sectorData?.clients || [];
          if (this.checkMatch(clients, normalizedTerm)) {
            results.push(i);
          }
        }
        if (results.length > 0) return results;
      } catch (error) {
        console.error("Cloud Search Error:", error);
      }
    }

    // Fallback
    for (let i = 1; i <= 10; i++) {
      const data = JSON.parse(localStorage.getItem(`bashayer_sector_${i}`));
      const clients = data?.clients || this.getDefaultClients();
      if (this.checkMatch(clients, normalizedTerm)) {
        results.push(i);
      }
    }
    return results;
  }

  checkMatch(clients, term) {
    if (!Array.isArray(clients)) return false;
    return clients.some(
      (client) => client && (
        (client.name && String(client.name).toLowerCase().includes(term)) ||
        (client.mobile && String(client.mobile).includes(term)) ||
        (client.plotNumber && (Array.isArray(client.plotNumber) ? client.plotNumber.some((p) => String(p).toLowerCase().includes(term)) : String(client.plotNumber).toLowerCase().includes(term))) ||
        (client.clientCode !== undefined && client.clientCode !== null && String(client.clientCode).toLowerCase().includes(term))
      ),
    );
  }

  async searchAllSectorsByCode(code) {
    const results = [];
    const normalizedCode = code.toLowerCase().trim();
    if (!normalizedCode) return results;

    await this.initFirebase();

    if (this.isFirebaseEnabled) {
      try {
        const snapshot = await this.db.ref("sectors").once("value");
        const sectors = snapshot.val() || {};
        for (let i = 1; i <= 10; i++) {
          const sectorData = sectors[i];
          const clients = sectorData?.clients || [];
          if (this.checkCodeMatch(clients, normalizedCode)) {
            results.push(i);
          }
        }
        if (results.length > 0) return results;
      } catch (error) {
        console.error("Cloud Search Error:", error);
      }
    }

    // Fallback
    for (let i = 1; i <= 10; i++) {
      const data = JSON.parse(localStorage.getItem(`bashayer_sector_${i}`));
      const clients = data?.clients || this.getDefaultClients();
      if (this.checkCodeMatch(clients, normalizedCode)) {
        results.push(i);
      }
    }
    return results;
  }

  checkCodeMatch(clients, code) {
    if (!Array.isArray(clients)) return false;
    return clients.some(
      (client) =>
        client && client.clientCode !== undefined && client.clientCode !== null && String(client.clientCode).toLowerCase().trim() === code,
    );
  }
}

// Global instance
window.dataService = new DataService();

// 4. Page Controllers

/**
 * Login Controller
 */
class AuthController {
  constructor() {
    this.form = document.getElementById("loginForm");
    if (!this.form) return;

    this.usernameInput = document.getElementById("username");
    this.passwordInput = document.getElementById("password");
    this.errorMsg = document.getElementById("errorMsg");
    this.submitBtn = document.getElementById("submitBtn");
    this.toggleBtn = document.getElementById("togglePasswordBtn");
    this.eyeIcon = document.getElementById("eyeIcon");
    this.card = document.querySelector(".glass-panel");

    this.init();
  }

  init() {
    if (typeof lucide !== "undefined") lucide.createIcons();
    if (localStorage.getItem("bashayer_logged_in") === "true") {
      window.location.replace("services.html");
    }
    this.attachEventListeners();
  }

  attachEventListeners() {
    this.form.addEventListener("submit", (e) => this.handleLogin(e));
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () =>
        this.togglePasswordVisibility(),
      );
    }
  }

  togglePasswordVisibility() {
    const isPassword = this.passwordInput.type === "password";
    this.passwordInput.type = isPassword ? "text" : "password";
    if (this.eyeIcon) {
      this.eyeIcon.setAttribute("data-lucide", isPassword ? "eye-off" : "eye");
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }

  handleLogin(e) {
    e.preventDefault();
    const user = this.usernameInput.value.trim();
    const pass = this.passwordInput.value.trim();

    if (user === "admin123" && pass === "admin123") {
      this.handleSuccess("services.html");
    } else {
      this.handleError();
    }
  }

  handleSuccess(redirectUrl = "services.html") {
    this.errorMsg.classList.add("hidden");
    localStorage.setItem("bashayer_logged_in", "true");
    this.submitBtn.innerHTML = `<i data-lucide="check-circle" class="w-5 h-5"></i> <span>جاري الدخول...</span>`;
    this.submitBtn.classList.remove(
      "bg-brand-green",
      "hover:bg-brand-greenHover",
    );
    this.submitBtn.classList.add("bg-brand-gold", "hover:bg-brand-goldHover");
    if (typeof lucide !== "undefined") lucide.createIcons();
    setTimeout(() => window.location.replace(redirectUrl), 600);
  }

  handleError() {
    this.errorMsg.classList.remove("hidden");
    if (this.card) {
      this.card.classList.add("animate-shake");
      setTimeout(() => this.card.classList.remove("animate-shake"), 500);
    }
  }
}

/**
 * Sectors Page Controller
 */
class SectorsRenderer {
  constructor() {
    this.container = document.getElementById("sectorsContainer");
    if (!this.container) return;

    this.sectorNames = [
      "الأول",
      "الثاني",
      "الثالث",
      "الرابع",
      "الخامس",
      "السادس",
      "السابع",
      "الثامن",
      "التاسع",
      "العاشر",
    ];
    this.init();
  }

  async init() {
    if (typeof lucide !== "undefined") lucide.createIcons();
    this.bindSearch();

    // Listen for all sectors real-time
    if (window.dataService) {
      window.dataService.subscribeToAllSectors((sectorsData) => {
        this.render(sectorsData);
      });
    } else {
      this.render({});
    }
  }

  render(cloudSectors = {}) {
    this.container.innerHTML = "";
    const fragment = document.createDocumentFragment();

    // Render Stats if we are on the accounts sectors page
    const statsContainer = document.getElementById("installmentStatsContainer");
    if (statsContainer) {
      let totalDueCurrentMonth = 0;
      let totalPaidCurrentMonth = 0;

      let totalDuePast = 0;
      let totalPaidPast = 0;
      let totalLatePayments = 0;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0 = Jan, 4 = May
      const currentDay = now.getDate();

      const parseDateRobust = (dateStr) => {
        if (!dateStr) return null;
        const strDate = String(dateStr);
        if (strDate.includes("-")) {
          const parts = strDate.split("-");
          if (parts[0].length === 4) {
            return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
          } else if (parts[2] && parts[2].length === 4) {
            return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
          }
        }
        if (strDate.includes("/")) {
          const parts = strDate.split("/");
          if (parts[2] && parts[2].length === 4) {
            return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
          } else if (parts[0] && parts[0].length === 4) {
            return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
          }
        }
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
        }
        return null;
      };

      // Helper function to calculate total paid for a client (matching DashboardController.calculateTotalPaid)
      const calculateClientTotalPaid = (client) => {
        let total = 0;

        // Add down payment
        if (client.downPayment) {
          total += Number(client.downPayment) || 0;
        }

        // Add checked installments
        for (let i = 1; i <= 10; i++) {
          const checkKey = `inst${i}_check`;
          const valueKey = `inst${i}`;
          if (client[checkKey] && client[valueKey]) {
            total += Number(client[valueKey]) || 0;
          }
        }

        // Subtract outstanding installments
        if (client.outstandingInstallments) {
          total -= Number(client.outstandingInstallments) || 0;
        }

        return total;
      };

      for (let sId = 1; sId <= 10; sId++) {
        const sector = cloudSectors[sId] || {};
        const clients = sector.clients || [];
        if (Array.isArray(clients)) {
          clients.forEach(client => {
            // دفعة التعاقد
            const dpVal = parseFloat(client.downPayment) || 0;

            // Add contract value to total due past
            const contractVal = parseFloat(client.contractValue) || 0;
            if (contractVal > 0) {
              totalDuePast += contractVal;
            }

            // Add installments to total due
            for (let i = 1; i <= 10; i++) {
              const instVal = parseFloat(client[`inst${i}`]) || 0;
              const instDateStr = client[`inst${i}Date`];
              const instCheck = client[`inst${i}_check`] || false;

              // التحقق من أن قيمة القسط صالحة
              if (instVal > 0) {

                if (instDateStr) {
                  const parsed = parseDateRobust(instDateStr);
                  if (parsed) {
                    // الشهر الحالي
                    if (parsed.year === currentYear && parsed.month === currentMonth) {
                      // 1. إضافة قيمة القسط لإجمالي الأقساط المستحقة هذا الشهر
                      totalDueCurrentMonth += instVal;

                      // 2. يتم احتساب القسط كـ "مدفوع" فقط وحصرياً إذا تم تفعيل خانة الاختيار (Checkbox) يدوياً
                      if (instCheck === true) {
                        totalPaidCurrentMonth += instVal;
                      }
                    }

                    // المتأخرات الفعلية (شهور سابقة ولم تدفع)
                    if (parsed.year < currentYear || (parsed.year === currentYear && parsed.month < currentMonth)) {
                      if (instCheck === false) {
                        totalLatePayments += instVal;
                      }
                    }
                  }
                }
              }
            }

            // Calculate paid amount using the same logic as dashboard
            totalPaidPast += calculateClientTotalPaid(client);
          });
        }
      }

      const totalRemainingCurrentMonth = totalDueCurrentMonth - totalPaidCurrentMonth;

      const monthName = now.toLocaleDateString("ar-EG", { month: "long" });
      const yearName = now.toLocaleDateString("ar-EG", { year: "numeric" });

      statsContainer.innerHTML = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <!-- مربع أقساط الشهر الحالي -->
          <div class="glass-panel rounded-3xl p-6 border border-brand-gold/20 shadow-lg bg-white/60 backdrop-blur-md">
            <h3 class="text-base font-bold text-brand-green mb-4 flex items-center justify-center gap-2">
              <i data-lucide="trending-up" class="w-5 h-5 text-brand-gold animate-pulse"></i>
              <span>إحصائيات أقساط الشهر الحالي (${monthName} ${yearName})</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Card 1: Total Due -->
              <div class="bg-brand-cream/60 rounded-2xl p-4 border border-brand-gold/15 flex flex-col items-center justify-center text-center shadow-sm">
                <span class="text-xs font-bold text-slate-500 mb-1">إجمالي أقساط الشهر</span>
                <span class="text-xl font-extrabold text-slate-800">${totalDueCurrentMonth.toLocaleString()} ج.م</span>
              </div>
              <!-- Card 2: Paid -->
              <div class="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-500/15 flex flex-col items-center justify-center text-center shadow-sm">
                <span class="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1">
                  <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i> المدفوع
                </span>
                <span class="text-xl font-extrabold text-emerald-700">${totalPaidCurrentMonth.toLocaleString()} ج.م</span>
              </div>
              <!-- Card 3: Remaining -->
              <div onclick="window.location.href='current_month_dues.html'" class="cursor-pointer hover:scale-105 transition-transform bg-amber-50/60 rounded-2xl p-4 border border-amber-500/15 flex flex-col items-center justify-center text-center shadow-sm relative group">
                <div class="absolute inset-0 bg-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                <span class="text-xs font-bold text-amber-600 mb-1 flex items-center gap-1">
                  <i data-lucide="alert-circle" class="w-4 h-4 text-amber-500"></i> المتبقي
                </span>
                <span class="text-xl font-extrabold text-amber-700">${totalRemainingCurrentMonth.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>

          <!-- مربع إحصائيات التعاقدات -->
          <div class="glass-panel rounded-3xl p-6 border border-red-500/20 shadow-lg bg-white/60 backdrop-blur-md">
            <h3 class="text-base font-bold text-red-600 mb-4 flex items-center justify-center gap-2">
              <i data-lucide="history" class="w-5 h-5 text-red-500 animate-pulse"></i>
              <span>إجمالي التعاقدات (مقدمات + أقساط)</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <!-- Card 1: Total Due -->
              <div class="bg-red-50/60 rounded-2xl p-4 border border-red-500/15 flex flex-col items-center justify-center text-center shadow-sm">
                <span class="text-xs font-bold text-slate-500 mb-1">إجمالي المستحق</span>
                <span class="text-xl font-extrabold text-slate-800">${totalDuePast.toLocaleString()} ج.م</span>
              </div>
              <!-- Card 2: Paid -->
              <div class="bg-emerald-50/60 rounded-2xl p-4 border border-emerald-500/15 flex flex-col items-center justify-center text-center shadow-sm">
                <span class="text-xs font-bold text-emerald-600 mb-1 flex items-center gap-1">
                  <i data-lucide="check-circle" class="w-4 h-4 text-emerald-500"></i> المدفوع
                </span>
                <span class="text-xl font-extrabold text-emerald-700">${totalPaidPast.toLocaleString()} ج.م</span>
              </div>
              <!-- Card 3: Remaining (Arrears) -->
              <div onclick="window.location.href='late_payments.html'" class="cursor-pointer hover:scale-105 transition-transform bg-red-100/60 rounded-2xl p-4 border border-red-500/30 flex flex-col items-center justify-center text-center shadow-sm relative group">
                <div class="absolute inset-0 bg-red-500/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                <span class="text-xs font-bold text-red-600 mb-1 flex items-center gap-1">
                  <i data-lucide="alert-triangle" class="w-4 h-4 text-red-500"></i> المتأخرات
                </span>
                <span class="text-xl font-extrabold text-red-700">${totalLatePayments.toLocaleString()} ج.م</span>
              </div>
            </div>
          </div>
        </div>
      `;
      statsContainer.classList.remove("hidden");
    }

    // Custom images per sector (relative path from HTML file location)
    const sectorImages = {
      1: "sectors icons/1.jpeg",
      2: "sectors icons/2.jpeg",
      3: "sectors icons/3.jpeg",
      4: "sectors icons/4.jpeg",
      5: "sectors icons/5.jpeg",
      6: "sectors icons/6.jpeg",
      7: "sectors icons/7.jpeg",
      8: "sectors icons/8.jpeg",
      9: "sectors icons/9.jpeg",
      10: "sectors icons/10.jpeg",
    };
    // 'circle' = image inside a circle icon | 'full' = image fills the entire card
    const sectorImageMode = {
      1: "full",
      2: "full",
      3: "full",
      4: "full",
      5: "full",
      6: "full",
      7: "full",
      8: "full",
      9: "full",
      10: "full",
    };

    this.sectorNames.forEach((defaultName, index) => {
      const sectorId = index + 1;
      const sectorData = cloudSectors[sectorId] || {};
      const name = sectorData.name || defaultName;
      const sectorImage = sectorImages[sectorId] || null;
      const imageMode = sectorImageMode[sectorId] || "circle";

      const anchor = document.createElement("a");
      anchor.id = `sector-card-${sectorId}`;
      const isAdmin = window.location.pathname.includes("admin_sectors.html");
      const isAccounts = window.location.pathname.includes(
        "accounts_sectors.html",
      );
      let targetPage = "dashboard.html";
      if (isAdmin) targetPage = "sector_clients.html";
      if (isAccounts) targetPage = "accounts_dashboard.html";
      anchor.href = `${targetPage}?sector=${sectorId}`;

      // Unified premium card design with background shapes, translucent watermark number, and top-right small badge
      anchor.className =
        "group glass-panel rounded-3xl p-6 border-2 border-brand-gold/15 hover:border-brand-gold shadow-md hover:shadow-xl hover:shadow-brand-green/5 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-brand-gold/20 bg-white/80 backdrop-blur-md relative overflow-hidden min-h-[160px] justify-center";

      const badgeLabel = isAdmin ? "لوحة المدير" : "إدارة الحسابات";
      const badgeIcon = isAdmin ? "shield" : "folder-open";

      anchor.innerHTML = `
        <!-- Top decorative brand gradient line -->
        <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-green via-brand-gold to-brand-green opacity-70 group-hover:opacity-100 transition-opacity"></div>
        
        <!-- Subtle, elegant abstract vector background shapes behind the text -->
        <div class="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-brand-green/5 group-hover:bg-brand-green/10 transition-all duration-500 z-0"></div>
        <div class="absolute -left-12 -top-12 w-28 h-28 rounded-full bg-brand-gold/5 group-hover:bg-brand-gold/10 transition-all duration-500 z-0"></div>
        
        <!-- Large elegant watermark sector number in the background behind the text -->
        <div class="absolute bottom-2 left-4 text-7xl font-black text-slate-200/30 select-none pointer-events-none group-hover:scale-105 group-hover:text-brand-gold/10 transition-all duration-500 z-0 font-sans">
          #${sectorId}
        </div>
        
        <!-- Small sector number badge in the top-right corner -->
        <div class="absolute top-3 right-3 bg-brand-greenLight text-brand-green border border-brand-green/20 text-[10px] font-black px-2 py-0.5 rounded-lg z-10 select-none">
          القطاع ${sectorId}
        </div>
        
        <!-- Premium Central Icon Container -->
        <div class="w-12 h-12 rounded-xl bg-brand-goldLight text-brand-gold flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-300 mb-3 border border-brand-gold/10 z-10">
          <i data-lucide="${badgeIcon}" class="w-5 h-5"></i>
        </div>
        
        <!-- Sector Name -->
        <h3 class="text-base font-extrabold text-slate-800 group-hover:text-brand-green transition-colors duration-300 mb-2 whitespace-nowrap z-10">
            ${String(name).includes("القطاع") ? name : "القطاع " + name}
        </h3>
        
        <!-- Role-based Dynamic Badge -->
        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-cream text-brand-gold border border-brand-gold/15 transition-all group-hover:bg-brand-greenLight group-hover:text-brand-green group-hover:border-brand-green/20 z-10">
            <i data-lucide="map" class="w-2.5 h-2.5"></i>
            <span>${badgeLabel}</span>
        </span>
      `;

      fragment.appendChild(anchor);
    });
    this.container.appendChild(fragment);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  bindSearch() {
    const searchInput = document.getElementById("globalSearchInput");
    const codeSearchInput = document.getElementById("codeSearchInput");
    const searchMessage = document.getElementById("searchMessage");
    if (!searchInput) return;

    const clearHighlights = () => {
      this.sectorNames.forEach((_, index) => {
        const card = document.getElementById(`sector-card-${index + 1}`);
        if (card) {
          card.classList.remove(
            "ring-4",
            "ring-brand-green",
            "scale-105",
            "bg-brand-green/5",
            "opacity-50",
          );
        }
      });
    };

    const handleSearch = async (term, isCodeOnly = false) => {
      clearHighlights();

      if (!term) {
        if (searchMessage) {
          searchMessage.textContent = "";
          searchMessage.className =
            "mt-3 text-sm font-bold h-5 transition-opacity opacity-0";
        }
        return;
      }

      const foundSectors = isCodeOnly
        ? await window.dataService.searchAllSectorsByCode(term)
        : await window.dataService.searchAllSectors(term);

      if (foundSectors.length > 0) {
        this.sectorNames.forEach((_, index) => {
          const sectorId = index + 1;
          const card = document.getElementById(`sector-card-${sectorId}`);
          if (card) {
            if (foundSectors.includes(sectorId))
              card.classList.add(
                "ring-4",
                "ring-brand-green",
                "scale-105",
                "bg-brand-green/5",
              );
            else card.classList.add("opacity-50");
          }
        });
        if (searchMessage) {
          searchMessage.textContent = `تم العثور على العميل في ${foundSectors.length} قطاع.`;
          searchMessage.className =
            "mt-3 text-sm font-bold text-brand-green h-5 transition-opacity opacity-100";
        }
      } else {
        this.sectorNames.forEach((_, index) => {
          const card = document.getElementById(`sector-card-${index + 1}`);
          if (card) card.classList.add("opacity-50");
        });
        if (searchMessage) {
          searchMessage.textContent = "لم يتم العثور على عميل يطابق بحثك.";
          searchMessage.className =
            "mt-3 text-sm font-bold text-red-500 h-5 transition-opacity opacity-100";
        }
      }
    };

    searchInput.addEventListener("input", async (e) => {
      if (codeSearchInput) codeSearchInput.value = "";
      const term = e.target.value.toLowerCase().trim();
      await handleSearch(term, false);
    });

    if (codeSearchInput) {
      codeSearchInput.addEventListener("input", async (e) => {
        if (searchInput) searchInput.value = "";
        const term = e.target.value.toLowerCase().trim();
        await handleSearch(term, true);
      });
    }
  }
}

/**
 * Dashboard Controller
 */
class DashboardController {
  constructor() {
    this.tableBody = document.getElementById("tableBody");
    this.clientsGrid = document.getElementById("clientsGrid");
    if (!this.tableBody && !this.clientsGrid) return;

    this.sectorId = this.getSectorIdFromUrl();
    if (!this.sectorId) return;

    this.validateSector();

    this.clients = [];
    this.sectorName = "";
    this.toastTimeout = null;

    this.cacheDOM();
    this.init();
  }

  getSectorIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("sector");
  }

  validateSector() {
    if (
      !this.sectorId ||
      isNaN(this.sectorId) ||
      this.sectorId < 1 ||
      this.sectorId > 10
    ) {
      window.location.replace("services.html");
    }
  }

  cacheDOM() {
    this.emptyState = document.getElementById("emptyState");
    this.searchInput = document.getElementById("searchInput");
    this.codeSearchInput = document.getElementById("codeSearchInput");
    this.modal = document.getElementById("clientModal");
    this.modalContent = document.getElementById("modalContent");
    this.form = document.getElementById("clientForm");
    this.modalTitle = document.getElementById("modalTitle");
    this.saveBtnText = document.getElementById("saveBtnText");
    this.toast = document.getElementById("toast");
    this.toastMessage = document.getElementById("toastMessage");
    this.statTotal = document.getElementById("stat-total");
    this.statArea = document.getElementById("stat-area");
    this.clientIdInput = document.getElementById("clientId");
    this.sectorTitleDisplay = document.getElementById("sectorTitleDisplay");
    this.statSectorName = document.getElementById("stat-sector-name");
  }

  async init() {
    if (typeof lucide !== "undefined") lucide.createIcons();
    this.bindEvents();

    // Subscribe to real-time updates
    if (window.dataService) {
      window.dataService.subscribeToSector(this.sectorId, (data) => {
        this.clients = data.clients || [];
        this.sectorName = data.name || this.sectorId;
        this.updateUI();
      });
    }
  }

  updateUI() {
    this.updateSyncStatus();
    this.renderTable();
    if (this.sectorTitleDisplay) {
      this.sectorTitleDisplay.textContent = this.sectorName;
    }
    if (this.statSectorName) {
      this.statSectorName.textContent = this.sectorName;
    }
  }

  updateSyncStatus() {
    const indicator = document.getElementById("syncIndicator");
    const icon = document.getElementById("syncIcon");
    const text = document.getElementById("syncStatusText");

    if (indicator && window.dataService) {
      indicator.classList.remove("opacity-0");
      if (window.dataService.isFirebaseEnabled) {
        indicator.classList.replace("bg-slate-100", "bg-green-100");
        indicator.classList.replace("text-slate-500", "text-green-600");
        if (icon) icon.setAttribute("data-lucide", "cloud-check");
        if (text) text.textContent = "متصل بالسحابة";
      } else {
        indicator.classList.replace("bg-green-100", "bg-slate-100");
        indicator.classList.replace("text-green-600", "text-slate-500");
        if (icon) icon.setAttribute("data-lucide", "cloud-off");
        if (text) text.textContent = "محلي فقط";
      }
      if (typeof lucide !== "undefined") lucide.createIcons();
    }
  }

  async saveData() {
    if (window.dataService) {
      await window.dataService.saveSectorData(this.sectorId, {
        name: this.sectorName,
        clients: this.clients,
      });
    }
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener("keyup", () => {
        if (this.codeSearchInput) this.codeSearchInput.value = "";
        this.renderTable();
      });
    }
    if (this.codeSearchInput) {
      this.codeSearchInput.addEventListener("keyup", () => {
        if (this.searchInput) this.searchInput.value = "";
        this.renderTable();
      });
    }
    if (this.form) {
      this.form.addEventListener("submit", (e) => this.handleFormSubmit(e));

      // Auto-calculate care directives
      const totalCareInput = document.getElementById("totalCare");
      const areaInput = document.getElementById("area");

      if (totalCareInput) {
        totalCareInput.addEventListener("input", () => {
          const total = parseFloat(totalCareInput.value) || 0;
          const qVal = total / 4;
          const quarter = total > 0 ? parseFloat(qVal.toFixed(2)).toString() : "";
          for (let i = 1; i <= 4; i++) {
            const careValInput = document.getElementById(`care${i}_val`);
            if (careValInput) careValInput.value = quarter;
          }
        });
      }

      // Auto-calculate total paid when inputs change
      const fieldsToWatch = [
        "downPayment",
        "outstandingInstallments",
        ...Array.from({ length: 10 }, (_, i) => `inst${i + 1}`),
        ...Array.from({ length: 10 }, (_, i) => `inst${i + 1}_check`),
      ];

      fieldsToWatch.forEach((fieldId) => {
        const field = document.getElementById(fieldId);
        if (field) {
          field.addEventListener("input", () => this.updateTotalPaidDisplay());
          field.addEventListener("change", () => this.updateTotalPaidDisplay());
        }
      });



      const addPlotBtn = document.getElementById("addPlotBtn");
      if (addPlotBtn) {
        addPlotBtn.addEventListener("click", () => this.addPlotNumberField());
      }
    }
    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.closeModal();
      });
    }
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        this.modal &&
        !this.modal.classList.contains("hidden")
      )
        this.closeModal();
    });

    // Global function bindings
    window.openModal = (id) => this.openModal(id);
    window.closeModal = () => this.closeModal();
    window.editClient = (id) => this.openModal(id);
    window.deleteClient = (id) => this.deleteClient(id);
    window.toggleCare = (id, directive, isChecked) =>
      this.toggleCare(id, directive, isChecked);
    window.toggleInst = (id, directive, isChecked) =>
      this.toggleInst(id, directive, isChecked);
    window.handleFormSubmit = (e) => this.handleFormSubmit(e);
    window.renderTable = () => this.renderTable();
    window.editSectorName = () => this.editSectorName();
    window.exportToExcel = () => this.exportToExcel();
  }

  async editSectorName() {
    const newName = prompt("أدخل الاسم الجديد للقطاع:", this.sectorName);
    if (newName && newName.trim() !== "" && newName !== this.sectorName) {
      this.sectorName = newName.trim();
      await this.saveData();
      this.showToast("تم تحديث اسم القطاع بنجاح.");
      this.updateUI();
    }
  }

  async exportToExcel() {
    try {
      const searchTerm = this.searchInput
        ? this.searchInput.value.toLowerCase().trim()
        : "";
      const codeSearchTerm = this.codeSearchInput
        ? this.codeSearchInput.value.toLowerCase().trim()
        : "";

      let filteredClients = this.clients;

      if (codeSearchTerm) {
        filteredClients = this.clients.filter(
          (client) =>
            client.clientCode !== undefined &&
            client.clientCode !== null &&
            String(client.clientCode).toLowerCase().trim() === codeSearchTerm,
        );
      } else if (searchTerm) {
        filteredClients = this.clients.filter(
          (client) =>
            (client.name && client.name.toLowerCase().includes(searchTerm)) ||
            (client.mobile && String(client.mobile).includes(searchTerm)) ||
            (client.plotNumber &&
              (Array.isArray(client.plotNumber)
                ? client.plotNumber.some((p) => String(p).toLowerCase().includes(searchTerm))
                : String(client.plotNumber).toLowerCase().includes(searchTerm))) ||
            (client.clientCode !== undefined &&
              client.clientCode !== null &&
              String(client.clientCode).toLowerCase().includes(searchTerm)),
        );
      }

      // Natural sort by clientCode like renderTable
      filteredClients = [...filteredClients].sort((a, b) => {
        const codeA = String(a.clientCode || "").trim();
        const codeB = String(b.clientCode || "").trim();
        return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
      });

      if (filteredClients.length === 0) {
        this.showToast("لا يوجد عملاء لتصديرهم.");
        return;
      }

      if (typeof ExcelJS === "undefined" || typeof saveAs === "undefined") {
        this.showToast("جاري تحميل مكتبات التصدير، يرجى المحاولة بعد قليل...");
        return;
      }

      this.showToast("جاري تجهيز الملف المنسق، يرجى الانتظار...");

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'بشاير النخيل';
      workbook.created = new Date();

      // Create sheet with strict RTL property
      const worksheet = workbook.addWorksheet("بيانات العملاء", {
        views: [{ rightToLeft: true }]
      });

      // Define Columns
      const columns = [
        { header: "كود العميل", key: "code", width: 15 },
        { header: "اسم العميل", key: "name", width: 35 },
        { header: "رقم الهاتف", key: "mobile", width: 20 },
        { header: "أرقام القطع", key: "plots", width: 20 },
        { header: "المساحة (فدان)", key: "area", width: 18 },
        { header: "دفعة التعاقد", key: "downpayment", width: 15 },
        { header: "تاريخ الدفعة", key: "downpayment_date", width: 15 }
      ];

      for (let i = 1; i <= 10; i++) {
        columns.push({ header: `القسط ${i}`, key: `inst${i}`, width: 15 });
        columns.push({ header: `تاريخ القسط ${i}`, key: `inst${i}_date`, width: 15 });
        columns.push({ header: `حالة القسط ${i}`, key: `inst${i}_status`, width: 15 });
      }

      columns.push({ header: "إجمالي الرعاية", key: "total_care", width: 15 });

      const months = ["ابريل", "يوليو", "اكتوبر", "يناير"];
      months.forEach((m, idx) => {
        columns.push({ header: `قيمة رعاية ${m}`, key: `care${idx + 1}_val`, width: 15 });
        columns.push({ header: `حالة رعاية ${m}`, key: `care${idx + 1}_status`, width: 15 });
      });

      worksheet.columns = columns;

      // Add Data Rows
      filteredClients.forEach((client) => {
        if (!client) return;
        const rowData = {
          code: client.clientCode || client.id || "-",
          name: client.name || "-",
          mobile: client.mobile || "-",
          plots: Array.isArray(client.plotNumber) ? client.plotNumber.join(", ") : (client.plotNumber || "-"),
          area: isNaN(parseFloat(client.area)) ? (client.area || 0) : parseFloat(client.area),
          downpayment: client.downPayment || 0,
          downpayment_date: this.formatDateString(client.downPaymentDate)
        };

        for (let i = 1; i <= 10; i++) {
          rowData[`inst${i}`] = client[`inst${i}`] || 0;
          rowData[`inst${i}_date`] = this.formatDateString(client[`inst${i}Date`]);
          rowData[`inst${i}_status`] = client[`inst${i}_check`] ? "تم الدفع" : "غير مدفوع";
        }

        rowData.total_care = client.totalCare || 0;

        for (let i = 1; i <= 4; i++) {
          rowData[`care${i}_val`] = client[`care${i}_val`] || "-";
          rowData[`care${i}_status`] = client[`care${i}`] ? "تم الدفع" : "غير مدفوع";
        }

        worksheet.addRow(rowData);
      });

      // Styling: Beautiful Header
      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF107C41' } // Excel Green
      };
      headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

      // Styling: All Cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell) => {
          if (rowNumber > 1) {
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          };
        });
      });

      // Write File
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const fileName = `بشاير_النخيل_حسابات_القطاع_${String(this.sectorName || this.sectorId).replace(/\s+/g, "_")}.xlsx`;

      saveAs(blob, fileName);
      this.showToast("تم تصدير ملف Excel بنجاح!");
    } catch (err) {
      console.error("Export error:", err);
      this.showToast("حدث خطأ أثناء التصدير.");
    }
  }

  formatDateString(dateStr) {
    if (!dateStr) return "-";
    const strDate = String(dateStr);
    const parts = strDate.split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
  }

  renderTable() {
    const searchTerm = this.searchInput
      ? this.searchInput.value.toLowerCase().trim()
      : "";
    const codeSearchTerm = this.codeSearchInput
      ? this.codeSearchInput.value.toLowerCase().trim()
      : "";

    let filteredClients = this.clients;

    if (codeSearchTerm) {
      filteredClients = this.clients.filter(
        (client) =>
          client.clientCode !== undefined &&
          client.clientCode !== null &&
          String(client.clientCode).toLowerCase().trim() === codeSearchTerm,
      );
    } else if (searchTerm) {
      filteredClients = this.clients.filter(
        (client) =>
          (client.name && client.name.toLowerCase().includes(searchTerm)) ||
          (client.mobile && String(client.mobile).includes(searchTerm)) ||
          (client.plotNumber &&
            (Array.isArray(client.plotNumber)
              ? client.plotNumber.some((p) => String(p).toLowerCase().includes(searchTerm))
              : String(client.plotNumber).toLowerCase().includes(searchTerm))) ||
          (client.clientCode !== undefined &&
            client.clientCode !== null &&
            String(client.clientCode).toLowerCase().includes(searchTerm)),
      );
    }

    // ترتيب العملاء ترتيباً طبيعياً حسب الكود
    filteredClients.sort((a, b) => {
      const codeA = String(a.clientCode || "").trim();
      const codeB = String(b.clientCode || "").trim();
      return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: "base" });
    });

    if (this.tableBody) this.tableBody.innerHTML = "";
    if (this.clientsGrid) this.clientsGrid.innerHTML = "";

    if (filteredClients.length === 0) {
      if (this.emptyState) {
        this.emptyState.classList.remove("hidden");
        this.emptyState.classList.add("flex");
      }
    } else {
      if (this.emptyState) {
        this.emptyState.classList.add("hidden");
        this.emptyState.classList.remove("flex");
      }

      const isAccounts = window.location.pathname.includes(
        "accounts_dashboard.html",
      );
      const isInvestors =
        window.location.pathname.includes("admin_dashboard.html") ||
        window.location.pathname.includes("sector_clients.html");
      const canEditCare = isAccounts;

      const fragment = document.createDocumentFragment();

      if (isInvestors && this.clientsGrid) {
        filteredClients.forEach((client) => {
          if (!client) return;
          const card = document.createElement("a");
          card.href = `client_details.html?sector=${this.sectorId}&client=${client.id || client.clientCode}`;
          card.className = "group glass-panel rounded-3xl p-6 border-2 border-brand-gold/15 hover:border-brand-gold shadow-md hover:shadow-xl hover:shadow-brand-green/5 transition-all duration-300 transform hover:-translate-y-1.5 flex flex-col items-center text-center focus:outline-none focus:ring-4 focus:ring-brand-gold/20 bg-white/80 backdrop-blur-md relative overflow-hidden";
          card.innerHTML = `
            <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-brand-green via-brand-gold to-brand-green opacity-70 group-hover:opacity-100 transition-opacity"></div>
            <div class="absolute -right-8 -bottom-8 w-28 h-28 rounded-full bg-brand-green/5 group-hover:bg-brand-green/10 transition-all duration-500 z-0"></div>
            
            <div class="w-16 h-16 rounded-2xl bg-brand-greenLight text-brand-green flex items-center justify-center shadow-sm group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 mb-4 border border-brand-green/20 z-10">
              <i data-lucide="user" class="w-8 h-8"></i>
            </div>
            
            <h3 class="text-lg font-extrabold text-slate-800 group-hover:text-brand-green transition-colors duration-300 mb-2 z-10">
                ${client.name || 'بدون اسم'}
            </h3>
            
            <div class="flex items-center gap-2 text-slate-500 font-bold text-sm mb-3 z-10">
                <i data-lucide="hash" class="w-4 h-4 text-brand-gold"></i>
                <span>${client.clientCode || client.id || '-'}</span>
            </div>
            
            <div class="mt-auto pt-4 border-t border-brand-gold/10 w-full flex justify-center z-10">
               <span class="inline-flex items-center gap-1.5 text-brand-gold font-bold group-hover:text-brand-green transition-colors">
                  <span>عرض صفحة العميل</span>
                  <i data-lucide="arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform"></i>
               </span>
            </div>
          `;
          fragment.appendChild(card);
        });
        this.clientsGrid.appendChild(fragment);
      } else if (this.tableBody) {
        filteredClients.forEach((client) => {
          if (!client) return;
          const tr = document.createElement("tr");
          tr.className =
            "hover:bg-brand-cream/40 transition-colors group border-b border-brand-gold/10 last:border-none bg-white";
          tr.innerHTML = `
                      <td class="px-3 py-3 whitespace-nowrap font-bold text-slate-700">${client.clientCode || client.id}</td>
                      <td class="px-3 py-3 whitespace-nowrap font-bold text-slate-800 ${isAccounts || isInvestors ? "sticky right-0 bg-white z-10 border-l border-brand-gold/10 shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.1)] group-hover:bg-brand-cream/40" : ""}">${client.name}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-slate-600 font-bold" dir="ltr" style="text-align: right;">${client.mobile}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-center">
                          <div class="flex flex-wrap gap-1 justify-center">${(Array.isArray(client.plotNumber) ? client.plotNumber : (client.plotNumber ? [client.plotNumber] : [])).map(p => `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-brand-goldLight text-brand-gold border border-brand-gold/30">${p}</span>`).join("")}</div>
                      </td>
                      <td class="px-3 py-3 whitespace-nowrap text-center text-brand-green font-bold">${isNaN(parseFloat(client.area)) ? client.area : Number(client.area).toLocaleString()}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-center font-bold text-slate-700 border-r border-brand-gold/10">${client.contractValue ? Number(client.contractValue).toLocaleString() : "-"}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-center font-bold text-brand-green border-r border-brand-gold/10">${this.calculateTotalPaid(client).toLocaleString()}</td>
                      ${isAccounts
              ? `
                      <td class="px-3 py-3 whitespace-nowrap text-center font-bold text-slate-700 border-r border-brand-gold/10">${client.downPayment ? Number(client.downPayment).toLocaleString() : "-"}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-center font-bold text-slate-500 text-[10px]">${this.formatDateString(client.downPaymentDate)}</td>
                      ${this.renderInstCell(client, 1, canEditCare)}
                      ${this.renderInstDateCell(client, 1)}
                      ${this.renderInstCell(client, 2, canEditCare)}
                      ${this.renderInstDateCell(client, 2)}
                      ${this.renderInstCell(client, 3, canEditCare)}
                      ${this.renderInstDateCell(client, 3)}
                      ${this.renderInstCell(client, 4, canEditCare)}
                      ${this.renderInstDateCell(client, 4)}
                      ${this.renderInstCell(client, 5, canEditCare)}
                      ${this.renderInstDateCell(client, 5)}
                      ${this.renderInstCell(client, 6, canEditCare)}
                      ${this.renderInstDateCell(client, 6)}
                      ${this.renderInstCell(client, 7, canEditCare)}
                      ${this.renderInstDateCell(client, 7)}
                      ${this.renderInstCell(client, 8, canEditCare)}
                      ${this.renderInstDateCell(client, 8)}
                      ${this.renderInstCell(client, 9, canEditCare)}
                      ${this.renderInstDateCell(client, 9)}
                      ${this.renderInstCell(client, 10, canEditCare)}
                      ${this.renderInstDateCell(client, 10)}
                      `
              : ""
            }
                      <td class="px-3 py-3 whitespace-nowrap text-center text-brand-gold font-bold">${client.totalCare ? Number(client.totalCare).toLocaleString() : "-"}</td>
                      <td class="px-3 py-3 whitespace-nowrap text-center font-bold text-orange-600 border-r border-brand-gold/10">${client.outstandingInstallments ? Number(client.outstandingInstallments).toLocaleString() : "-"}</td>
                      <td class="px-3 py-3 text-center border-r border-brand-gold/10">
                          ${client.notes ? `
                          <div class="relative inline-flex group">
                              <i data-lucide="message-square" class="w-5 h-5 text-brand-gold cursor-help hover:text-brand-goldHover transition-colors"></i>
                              <div class="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg whitespace-normal max-w-sm opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg">
                                  ${client.notes}
                                  <div class="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                              </div>
                          </div>
                          ` : '<span class="text-slate-400">-</span>'}
                      </td>
                      ${this.renderCareCell(client, 1, canEditCare)}
                      ${this.renderCareCell(client, 2, canEditCare)}
                      ${this.renderCareCell(client, 3, canEditCare)}
                      ${this.renderCareCell(client, 4, canEditCare)}
                      ${isAccounts
              ? `
                      <td class="px-3 py-3 whitespace-nowrap text-center">
                          <div class="flex justify-center gap-1.5 opacity-50 group-hover:opacity-100 transition-opacity">
                              <button onclick="editClient(${client.id})" class="p-1.5 text-brand-gold hover:bg-brand-goldLight rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-brand-gold" title="تعديل">
                                  <i data-lucide="edit-3" class="w-4 h-4"></i>
                              </button>
                              <button onclick="deleteClient(${client.id})" class="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-300" title="حذف">
                                  <i data-lucide="trash-2" class="w-4 h-4"></i>
                              </button>
                          </div>
                      </td>
                      `
              : ""
            }
                  `;
          fragment.appendChild(tr);
        });
        this.tableBody.appendChild(fragment);
      }

      if (typeof lucide !== "undefined") lucide.createIcons();
    }
    this.updateStats();
  }

  renderCareCell(client, num, isAdmin = false) {
    const isChecked = client[`care${num}`];
    const val = client[`care${num}_val`];
    return `
            <td class="px-2 py-3">
                <div class="flex items-center justify-between gap-1.5 bg-brand-cream/50 px-2 py-1 rounded-lg border border-brand-gold/20 shadow-sm">
                    <span class="text-xs font-bold text-brand-green truncate max-w-[60px]" title="${val || "بدون قيمة"}">${val || "-"}</span>
                    <input type="checkbox" class="care-checkbox shrink-0" ${isChecked ? "checked" : ""} 
                        ${isAdmin ? `onchange="toggleCare(${client.id}, 'care${num}', this.checked)"` : "disabled"}>
                </div>
            </td>
        `;
  }

  checkOverdue(client, num) {
    const isChecked = client[`inst${num}_check`];
    const val = parseFloat(client[`inst${num}`]) || 0;
    const dateStr = client[`inst${num}Date`];

    if (val > 0 && !isChecked && dateStr) {
      let year, month, day;
      const strDate = String(dateStr);
      if (strDate.includes("-")) {
        const parts = strDate.split("-");
        if (parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        } else if (parts[2].length === 4) {
          year = parseInt(parts[2], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[0], 10);
        }
      } else if (strDate.includes("/")) {
        const parts = strDate.split("/");
        if (parts[2] && parts[2].length === 4) {
          year = parseInt(parts[2], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[0], 10);
        } else if (parts[0] && parts[0].length === 4) {
          year = parseInt(parts[0], 10);
          month = parseInt(parts[1], 10) - 1;
          day = parseInt(parts[2], 10);
        }
      } else {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          year = d.getFullYear();
          month = d.getMonth();
          day = d.getDate();
        }
      }

      if (year !== undefined && month !== undefined && day !== undefined) {
        const parsedDate = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return parsedDate <= today;
      }
    }
    return false;
  }

  renderInstDateCell(client, num) {
    const isOverdue = this.checkOverdue(client, num);
    const dateStr = client[`inst${num}Date`];
    const formatted = this.formatDateString(dateStr);
    const cellClass = isOverdue
      ? "bg-red-50/50 text-red-600 font-extrabold"
      : "text-slate-500 font-bold";
    return `<td class="px-3 py-3 whitespace-nowrap text-center ${cellClass} text-[10px]">${formatted}</td>`;
  }

  renderInstCell(client, num, isAdmin = false) {
    const isChecked = client[`inst${num}_check`];
    const val = client[`inst${num}`];
    const isOverdue = this.checkOverdue(client, num);

    const containerClass = isOverdue
      ? "bg-red-50 border-red-300 text-red-700 shadow-[0_0_8px_rgba(239,68,68,0.15)]"
      : "bg-brand-cream/50 border-brand-gold/20 text-slate-700 shadow-sm";

    const textClass = isOverdue
      ? "text-red-700 font-extrabold"
      : "text-slate-700";

    return `
            <td class="px-2 py-3 border-r border-brand-gold/10">
                <div class="flex items-center justify-between gap-1.5 px-2 py-1 rounded-lg border ${containerClass}">
                    <span class="text-xs font-bold ${textClass} truncate max-w-[60px]" title="${val ? Number(val).toLocaleString() : "بدون قيمة"}">${val ? Number(val).toLocaleString() : "-"}</span>
                    <input type="checkbox" class="care-checkbox shrink-0" ${isChecked ? "checked" : ""} 
                        ${isAdmin ? `onchange="toggleInst(${client.id}, 'inst${num}_check', this.checked)"` : "disabled"}>
                </div>
            </td>
        `;
  }

  toggleInst(id, directive, isChecked) {
    const client = this.clients.find((c) => c.id === id);
    if (client) {
      client[directive] = isChecked;
      this.saveData();
    }
  }

  updateStats() {
    if (this.statTotal) this.statTotal.textContent = this.clients.length;
    if (this.statArea) {
      const totalArea = this.clients.reduce(
        (sum, client) => {
          const a = parseFloat(client.area);
          return sum + (isNaN(a) ? 0 : a);
        },
        0,
      );
      this.statArea.textContent = totalArea.toLocaleString();
    }
  }

  clearPlotNumberFields() {
    const container = document.getElementById("plotNumbersContainer");
    if (!container) return;
    container.innerHTML = "";
    this.addPlotNumberField();
  }

  addPlotNumberField(value = "") {
    const container = document.getElementById("plotNumbersContainer");
    if (!container) return;
    const wrapper = document.createElement("div");
    wrapper.className = "flex gap-2 items-center";
    wrapper.innerHTML = `
      <div class="relative flex-1">
        <i data-lucide="map-pin" class="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-brand-gold"></i>
        <input type="text" class="plot-number-input w-full pr-10 pl-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-brand-green focus:border-brand-green outline-none transition-all placeholder-slate-400" placeholder="رقم القطعة" value="${value}" />
      </div>
      <button type="button" class="remove-plot-btn shrink-0 p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="حذف القطعة">
        <i data-lucide="x" class="w-4 h-4"></i>
      </button>
    `;
    wrapper.querySelector(".remove-plot-btn").addEventListener("click", () => {
      if (container.children.length > 1) wrapper.remove();
    });
    container.appendChild(wrapper);
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  toggleCare(id, directive, isChecked) {
    const client = this.clients.find((c) => c.id === id);
    if (client) {
      client[directive] = isChecked;
      this.saveData();
    }
  }

  calculateTotalPaid(client) {
    let total = 0;

    // Add down payment
    if (client.downPayment) {
      total += Number(client.downPayment) || 0;
    }

    // Add checked installments
    for (let i = 1; i <= 10; i++) {
      const checkKey = `inst${i}_check`;
      const valueKey = `inst${i}`;
      if (client[checkKey] && client[valueKey]) {
        total += Number(client[valueKey]) || 0;
      }
    }

    // Subtract outstanding installments
    if (client.outstandingInstallments) {
      total -= Number(client.outstandingInstallments) || 0;
    }

    return total;
  }

  updateTotalPaidDisplay() {
    // Calculate from current form values
    let total = 0;

    // Add down payment
    const downPaymentInput = document.getElementById("downPayment");
    if (downPaymentInput) {
      total += Number(downPaymentInput.value) || 0;
    }

    // Add checked installments
    for (let i = 1; i <= 10; i++) {
      const checkInput = document.getElementById(`inst${i}_check`);
      const valueInput = document.getElementById(`inst${i}`);
      if (checkInput && checkInput.checked && valueInput) {
        total += Number(valueInput.value) || 0;
      }
    }

    // Subtract outstanding installments
    const outstandingInput = document.getElementById("outstandingInstallments");
    if (outstandingInput) {
      total -= Number(outstandingInput.value) || 0;
    }

    // Update display
    const totalPaidInput = document.getElementById("totalPaid");
    if (totalPaidInput) {
      totalPaidInput.value = total > 0 ? Number(total).toLocaleString() : "0";
    }
  }

  openModal(clientId = null) {
    if (!this.form || !this.modal) return;
    this.form.reset();
    this.clientIdInput.value = "";
    this.clearPlotNumberFields();

    if (clientId) {
      if (this.modalTitle)
        this.modalTitle.innerHTML = `<i data-lucide="user-pen" class="w-5 h-5 text-brand-gold"></i> <span class="text-brand-green">تعديل بيانات العميل #${clientId}</span>`;
      if (this.saveBtnText) this.saveBtnText.textContent = "تحديث العميل";

      const client = this.clients.find((c) => c.id === clientId);
      if (client) {
        this.clientIdInput.value = client.id;
        document.getElementById("clientCode").value = client.clientCode || "";
        document.getElementById("clientName").value = client.name;
        document.getElementById("mobile").value = client.mobile;
        const plots = Array.isArray(client.plotNumber) ? client.plotNumber : (client.plotNumber ? [client.plotNumber] : [""]);
        this.clearPlotNumberFields();
        const firstInput = document.querySelector(".plot-number-input");
        if (firstInput) firstInput.value = plots[0] || "";
        for (let pi = 1; pi < plots.length; pi++) this.addPlotNumberField(plots[pi]);
        document.getElementById("area").value = client.area;
        document.getElementById("totalCare").value = client.totalCare || "";

        // Trigger care calculation on open
        if (client.totalCare) {
          const qVal = parseFloat(client.totalCare) / 4;
          const quarter = parseFloat(qVal.toFixed(2)).toString();
          for (let i = 1; i <= 4; i++) {
            const careValInput = document.getElementById(`care${i}_val`);
            if (careValInput) careValInput.value = quarter;
          }
        }

        if (document.getElementById("downPayment")) {
          document.getElementById("downPayment").value =
            client.downPayment || "";
          if (document.getElementById("downPaymentDate"))
            document.getElementById("downPaymentDate").value =
              client.downPaymentDate || "";
        }
        for (let i = 1; i <= 10; i++) {
          if (document.getElementById(`inst${i}`)) {
            document.getElementById(`inst${i}`).value =
              client[`inst${i}`] || "";
          }
          if (document.getElementById(`inst${i}Date`))
            document.getElementById(`inst${i}Date`).value =
              client[`inst${i}Date`] || "";
          if (document.getElementById(`inst${i}_check`))
            document.getElementById(`inst${i}_check`).checked =
              client[`inst${i}_check`] || false;
        }

        for (let i = 1; i <= 4; i++) {
          const check = document.getElementById(`care${i}_check`);
          const val = document.getElementById(`care${i}_val`);
          if (check) check.checked = client[`care${i}`] || false;
          if (val) val.value = client[`care${i}_val`] || "";
        }

        // Set new financial fields
        const contractValueInput = document.getElementById("contractValue");
        if (contractValueInput) contractValueInput.value = client.contractValue || "";
        
        const outstandingInput = document.getElementById("outstandingInstallments");
        if (outstandingInput) outstandingInput.value = client.outstandingInstallments || "";
        
        const notesInput = document.getElementById("notes");
        if (notesInput) notesInput.value = client.notes || "";
        
        this.updateTotalPaidDisplay();
      }
    } else {
      if (this.modalTitle)
        this.modalTitle.innerHTML = `<i data-lucide="user-plus" class="w-5 h-5 text-brand-gold"></i> <span class="text-brand-green">إضافة عميل جديد</span>`;
      if (this.saveBtnText) this.saveBtnText.textContent = "حفظ العميل";
    }

    if (typeof lucide !== "undefined") lucide.createIcons();
    this.modal.classList.remove("hidden");
    void this.modal.offsetWidth;
    this.modal.classList.remove("opacity-0");
    if (this.modalContent) this.modalContent.classList.remove("scale-95");
    setTimeout(() => {
      const nameInput = document.getElementById("clientName");
      if (nameInput) nameInput.focus();
    }, 100);
  }

  closeModal() {
    if (!this.modal) return;
    this.modal.classList.add("opacity-0");
    if (this.modalContent) this.modalContent.classList.add("scale-95");
    setTimeout(() => this.modal.classList.add("hidden"), 300);
  }

  handleFormSubmit(e) {
    if (e) e.preventDefault();
    const idVal = this.clientIdInput.value;
    const clientData = {
      clientCode: document.getElementById("clientCode").value.trim(),
      name: document.getElementById("clientName").value.trim(),
      mobile: document.getElementById("mobile").value.trim(),
      plotNumber: (() => { const vals = Array.from(document.querySelectorAll(".plot-number-input")).map(i => i.value.trim()).filter(v => v !== ""); return vals.length === 1 ? vals[0] : vals; })(),
      area: document.getElementById("area").value.trim(),
      totalCare: Number(document.getElementById("totalCare").value) || 0,
    };

    if (document.getElementById("contractValue")) {
      clientData.contractValue = Number(document.getElementById("contractValue").value) || 0;
    } else if (idVal) {
      const existingClient = this.clients.find(c => c.id == idVal);
      if (existingClient) clientData.contractValue = existingClient.contractValue || 0;
    }

    if (document.getElementById("outstandingInstallments")) {
      clientData.outstandingInstallments = Number(document.getElementById("outstandingInstallments").value) || 0;
    } else if (idVal) {
      const existingClient = this.clients.find(c => c.id == idVal);
      if (existingClient) clientData.outstandingInstallments = existingClient.outstandingInstallments || 0;
    }

    if (document.getElementById("notes")) {
      clientData.notes = document.getElementById("notes").value.trim();
    } else if (idVal) {
      const existingClient = this.clients.find(c => c.id == idVal);
      if (existingClient) clientData.notes = existingClient.notes || "";
    }

    if (document.getElementById("downPayment")) {
      clientData.downPayment =
        Number(document.getElementById("downPayment").value) || 0;
      if (document.getElementById("downPaymentDate"))
        clientData.downPaymentDate =
          document.getElementById("downPaymentDate").value;
    }
    for (let i = 1; i <= 10; i++) {
      if (document.getElementById(`inst${i}`)) {
        clientData[`inst${i}`] =
          Number(document.getElementById(`inst${i}`).value) || 0;
        if (document.getElementById(`inst${i}Date`)) {
          clientData[`inst${i}Date`] = document.getElementById(
            `inst${i}Date`,
          ).value;
        }
        const instCheck = document.getElementById(`inst${i}_check`);
        clientData[`inst${i}_check`] = instCheck ? instCheck.checked : false;
      }
    }

    for (let i = 1; i <= 4; i++) {
      const check = document.getElementById(`care${i}_check`);
      const val = document.getElementById(`care${i}_val`);
      clientData[`care${i}`] = check ? check.checked : false;
      clientData[`care${i}_val`] = val ? val.value.trim() : "";
    }

    if (idVal) {
      const id = parseInt(idVal, 10);
      const index = this.clients.findIndex((c) => c.id === id);
      if (index > -1) {
        this.clients[index] = { ...this.clients[index], ...clientData };
        this.showToast(`تم تحديث بيانات العميل ${clientData.name} بنجاح!`);
      }
    } else {
      clientData.id = Date.now();
      this.clients.unshift(clientData);
      this.showToast(`تمت إضافة العميل ${clientData.name} بنجاح!`);
    }

    this.saveData();
    this.closeModal();
  }

  deleteClient(id) {
    const client = this.clients.find((c) => c.id === id);
    if (
      client &&
      confirm(
        `هل أنت متأكد من رغبتك في حذف ${client.name}؟ لا يمكن التراجع عن هذا الإجراء.`,
      )
    ) {
      this.clients = this.clients.filter((c) => c.id !== id);
      this.saveData();
      this.showToast("تم حذف العميل بنجاح.");
    }
  }

  showToast(message) {
    if (!this.toast || !this.toastMessage) return;
    this.toastMessage.textContent = message;
    this.toast.classList.remove("translate-y-20", "opacity-0");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add("translate-y-20", "opacity-0");
    }, 3000);
  }
}

/**
 * Late Payments Controller
 */
class LatePaymentsController {
  constructor() {
    this.tableBody = document.getElementById("lateTableBody");
    if (!this.tableBody) return;

    this.cloudSectors = {};
    this.latePayments = [];
    this.cacheDOM();
    this.init();
  }

  cacheDOM() {
    this.emptyState = document.getElementById("emptyState");
    this.searchInput = document.getElementById("searchInput");
    this.toast = document.getElementById("toast");
    this.toastMessage = document.getElementById("toastMessage");
  }

  async init() {
    if (typeof lucide !== "undefined") lucide.createIcons();
    this.bindEvents();

    if (window.dataService) {
      window.dataService.subscribeToAllSectors((sectorsData) => {
        this.cloudSectors = sectorsData || {};
        this.processLatePayments();
        this.renderTable();
      });
    }
  }

  processLatePayments() {
    this.latePayments = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const parseDateRobust = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts[0].length === 4) {
          return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
        } else if (parts[2] && parts[2].length === 4) {
          return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
        }
      }
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts[2] && parts[2].length === 4) {
          return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
        } else if (parts[0] && parts[0].length === 4) {
          return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
      }
      return null;
    };

    for (let sId = 1; sId <= 10; sId++) {
      const sector = this.cloudSectors[sId] || {};
      const clients = sector.clients || [];
      const sectorName = sector.name || window.dataService.getDefaultSectorName(sId);

      if (Array.isArray(clients)) {
        clients.forEach(client => {
          let clientInstallments = [];
          for (let i = 1; i <= 10; i++) {
            const instVal = parseFloat(client[`inst${i}`]) || 0;
            const instDateStr = client[`inst${i}Date`];
            const instCheck = client[`inst${i}_check`] || false;

            if (instVal > 0 && instDateStr && !instCheck) {
              const parsed = parseDateRobust(instDateStr);
              if (parsed && (parsed.year < currentYear || (parsed.year === currentYear && parsed.month < currentMonth))) {
                clientInstallments.push({
                  instNum: i,
                  instName: this.getInstName(i),
                  instVal: instVal,
                  instDate: instDateStr
                });
              }
            }
          }

          if (clientInstallments.length > 0) {
            // Sort client's installments by date ascending
            clientInstallments.sort((a, b) => new Date(a.instDate) - new Date(b.instDate));

            this.latePayments.push({
              sectorId: sId,
              sectorName: sectorName,
              clientId: client.id,
              clientName: client.name || "",
              clientCode: client.clientCode || "",
              clientPhone: client.mobile || "",
              clientPlot: Array.isArray(client.plotNumber) ? client.plotNumber : (client.plotNumber ? [client.plotNumber] : []),
              installments: clientInstallments,
              oldestDate: clientInstallments[0].instDate
            });
          }
        });
      }
    }

    // Sort clients by their oldest installment date ascending
    this.latePayments.sort((a, b) => new Date(a.oldestDate) - new Date(b.oldestDate));
  }

  getInstName(num) {
    const names = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
    return `القسط ${names[num - 1]}`;
  }

  formatDateString(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ar-EG", { year: "numeric", month: "short", day: "numeric" });
  }

  renderTable() {
    if (!this.tableBody) return;

    let filtered = this.latePayments;
    if (this.searchInput && this.searchInput.value) {
      const term = this.searchInput.value.toLowerCase().trim();
      filtered = filtered.filter(lp =>
        lp.clientName.toLowerCase().includes(term) ||
        lp.clientPhone.includes(term) ||
        String(lp.clientPlot).toLowerCase().includes(term) ||
        lp.sectorName.toLowerCase().includes(term)
      );
    }

    if (filtered.length === 0) {
      this.tableBody.parentElement.classList.add("hidden");
      if (this.emptyState) this.emptyState.classList.remove("hidden");
      this.tableBody.innerHTML = "";
      return;
    }

    this.tableBody.parentElement.classList.remove("hidden");
    if (this.emptyState) this.emptyState.classList.add("hidden");

    let html = "";
    filtered.forEach((lp, index) => {
      const bgClass = index % 2 === 0 ? "bg-white" : "bg-slate-50/80";
      const instNamesHtml = lp.installments.map(i => `<div class="py-2">${i.instName}</div>`).join('');
      const instValsHtml = lp.installments.map(i => `<div class="py-2">${i.instVal.toLocaleString()} ج.م</div>`).join('');
      const instDatesHtml = lp.installments.map(i => `<div class="py-2">${this.formatDateString(i.instDate)}</div>`).join('');
      html += `
        <tr class="${bgClass} hover:bg-brand-cream/60 transition-colors border-b-2 border-slate-200">
          <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-700 border-l border-brand-gold/10 align-middle text-center">
            ${lp.clientCode || lp.clientId}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm font-bold text-slate-800 border-l border-brand-gold/10 align-middle">
            ${lp.clientName}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-brand-gold font-bold text-center border-l border-brand-gold/10 align-middle">
            القطاع ${lp.sectorName}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-sm text-slate-600 text-center border-l border-brand-gold/10 align-middle" dir="ltr">
            ${lp.clientPhone}
          </td>
          <td class="px-4 py-3 whitespace-nowrap text-center border-l border-brand-gold/10 align-middle">
            <div class="flex flex-wrap gap-1 justify-center">${lp.clientPlot.map(p => `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-brand-goldLight text-brand-gold border border-brand-gold/30">${p}</span>`).join("")}</div>
          </td>
          <td class="px-4 py-1 whitespace-nowrap text-sm text-brand-green font-bold text-center border-l border-brand-gold/10 align-middle divide-y divide-brand-gold/20">
            ${instNamesHtml}
          </td>
          <td class="px-4 py-1 whitespace-nowrap text-sm text-red-600 font-bold text-center border-l border-brand-gold/10 align-middle divide-y divide-brand-gold/20">
            ${instValsHtml}
          </td>
          <td class="px-4 py-1 whitespace-nowrap text-sm text-slate-500 text-center text-[11px] border-l border-brand-gold/10 align-middle divide-y divide-brand-gold/20">
            ${instDatesHtml}
          </td>
        </tr>
      `;
    });

    this.tableBody.innerHTML = html;
  }

  bindEvents() {
    if (this.searchInput) {
      this.searchInput.addEventListener("keyup", () => this.renderTable());
    }

    window.toggleLateInst = async (sectorId, clientId, instNum, isChecked) => {
      if (!isChecked) return;

      const sector = this.cloudSectors[sectorId];
      if (sector && sector.clients) {
        const client = sector.clients.find(c => c.id === clientId);
        if (client) {
          client[`inst${instNum}_check`] = true;
          await window.dataService.saveSectorData(sectorId, sector);
          this.showToast("تم تحديث حالة القسط إلى مدفوع بنجاح!");
        }
      }
    };
  }

  showToast(message) {
    if (!this.toast || !this.toastMessage) return;
    this.toastMessage.textContent = message;
    this.toast.classList.remove("translate-y-20", "opacity-0");
    clearTimeout(this.toastTimeout);
    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add("translate-y-20", "opacity-0");
    }, 3000);
  }
}

/**
 * Current Month Dues Controller
 */
class CurrentMonthDuesController {
  constructor() {
    this.arrivedTableBody = document.getElementById("arrivedTableBody");
    this.upcomingTableBody = document.getElementById("upcomingTableBody");
    if (!this.arrivedTableBody || !this.upcomingTableBody) return;

    this.cloudSectors = {};
    this.arrivedDues = [];
    this.upcomingDues = [];
    this.init();
  }

  async init() {
    if (typeof lucide !== "undefined") lucide.createIcons();

    if (window.dataService) {
      window.dataService.subscribeToAllSectors((sectorsData) => {
        this.cloudSectors = sectorsData || {};
        this.processDues();
        this.renderTables();
      });
    }
  }

  processDues() {
    this.arrivedDues = [];
    this.upcomingDues = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const currentDay = now.getDate();

    const parseDateRobust = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes("-")) {
        const parts = dateStr.split("-");
        if (parts[0].length === 4) {
          return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
        } else if (parts[2] && parts[2].length === 4) {
          return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
        }
      }
      if (dateStr.includes("/")) {
        const parts = dateStr.split("/");
        if (parts[2] && parts[2].length === 4) {
          return { year: parseInt(parts[2], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[0], 10) || 1 };
        } else if (parts[0] && parts[0].length === 4) {
          return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) - 1, day: parseInt(parts[2], 10) || 1 };
        }
      }
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
      }
      return null;
    };

    for (let sId = 1; sId <= 10; sId++) {
      const sector = this.cloudSectors[sId] || {};
      const clients = sector.clients || [];
      const sectorName = sector.name || window.dataService.getDefaultSectorName(sId);

      if (Array.isArray(clients)) {
        clients.forEach(client => {
          let clientArrived = [];
          let clientUpcoming = [];
          for (let i = 1; i <= 10; i++) {
            const instVal = parseFloat(client[`inst${i}`]) || 0;
            const instDateStr = client[`inst${i}Date`];
            const instCheck = client[`inst${i}_check`] || false;

            if (instVal > 0 && instDateStr && !instCheck) {
              const parsed = parseDateRobust(instDateStr);
              if (parsed && parsed.year === currentYear && parsed.month === currentMonth) {
                const installmentData = {
                  instNum: i,
                  instName: this.getInstName(i),
                  instVal: instVal,
                  instDate: instDateStr,
                  isPaid: instCheck
                };

                if (parsed.day <= currentDay) {
                  clientArrived.push(installmentData);
                } else {
                  clientUpcoming.push(installmentData);
                }
              }
            }
          }

          if (clientArrived.length > 0) {
            clientArrived.sort((a, b) => new Date(a.instDate) - new Date(b.instDate));
            this.arrivedDues.push({
              sectorId: sId,
              sectorName: sectorName,
              clientId: client.id,
              clientName: client.name || "",
              clientCode: client.clientCode || "",
              clientPhone: client.mobile || "",
              clientPlot: Array.isArray(client.plotNumber) ? client.plotNumber : (client.plotNumber ? [client.plotNumber] : []),
              installments: clientArrived,
              oldestDate: clientArrived[0].instDate
            });
          }

          if (clientUpcoming.length > 0) {
            clientUpcoming.sort((a, b) => new Date(a.instDate) - new Date(b.instDate));
            this.upcomingDues.push({
              sectorId: sId,
              sectorName: sectorName,
              clientId: client.id,
              clientName: client.name || "",
              clientCode: client.clientCode || "",
              clientPhone: client.mobile || "",
              clientPlot: Array.isArray(client.plotNumber) ? client.plotNumber : (client.plotNumber ? [client.plotNumber] : []),
              installments: clientUpcoming,
              oldestDate: clientUpcoming[0].instDate
            });
          }
        });
      }
    }

    this.arrivedDues.sort((a, b) => new Date(a.oldestDate) - new Date(b.oldestDate));
    this.upcomingDues.sort((a, b) => new Date(a.oldestDate) - new Date(b.oldestDate));
  }

  getInstName(num) {
    const names = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر"];
    return `القسط ${names[num - 1]}`;
  }

  formatDateString(dateStr) {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  renderTables() {
    this.renderTableBody(this.arrivedTableBody, this.arrivedDues, "arrivedEmptyState");
    this.renderTableBody(this.upcomingTableBody, this.upcomingDues, "upcomingEmptyState");
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  renderTableBody(tbody, data, emptyStateId) {
    tbody.innerHTML = "";
    const emptyState = document.getElementById(emptyStateId);

    if (data.length === 0) {
      if (emptyState) emptyState.classList.replace("hidden", "flex");
      return;
    }

    if (emptyState) emptyState.classList.replace("flex", "hidden");

    const fragment = document.createDocumentFragment();
    data.forEach((item) => {
      item.installments.forEach((inst, index) => {
        const isFirst = index === 0;
        const rowspan = item.installments.length;
        const tr = document.createElement("tr");
        tr.className = "hover:bg-brand-gold/5 transition-colors border-b border-slate-100 last:border-0";

        let html = "";
        if (isFirst) {
          html += `
            <td class="px-4 py-3 font-bold text-slate-700 border-l border-slate-100 whitespace-nowrap text-center" rowspan="${rowspan}">
              ${item.clientCode || item.clientId}
            </td>
            <td class="px-4 py-3 font-bold text-brand-green border-l border-slate-100" rowspan="${rowspan}">
              <div class="flex items-center gap-2 justify-start">
                <span>${item.clientName || "-"}</span>
                <div class="w-8 h-8 rounded-full bg-brand-cream flex items-center justify-center text-brand-gold shrink-0">
                  <i data-lucide="user" class="w-4 h-4"></i>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 text-center font-bold text-slate-700 border-l border-slate-100" rowspan="${rowspan}">
              <span class="bg-brand-cream text-brand-gold px-2.5 py-1 rounded-lg text-xs">
                ${item.sectorName}
              </span>
            </td>
            <td class="px-4 py-3 text-center text-slate-600 border-l border-slate-100" rowspan="${rowspan}" dir="ltr">${item.clientPhone || "-"}</td>
            <td class="px-4 py-3 text-center border-l border-slate-100" rowspan="${rowspan}">
              <div class="flex flex-wrap gap-1 justify-center">${item.clientPlot.map(p => `<span class="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-bold bg-brand-goldLight text-brand-gold border border-brand-gold/30">${p}</span>`).join("")}</div>
            </td>
          `;
        }

        html += `
          <td class="px-4 py-3 text-center border-l border-slate-100 text-brand-gold font-bold">${inst.instName}</td>
          <td class="px-4 py-3 text-center font-bold text-slate-800 border-l border-slate-100 bg-brand-cream/30">${inst.instVal.toLocaleString()} ج.م</td>
          <td class="px-4 py-3 text-center border-l border-slate-100 font-medium">${this.formatDateString(inst.instDate)}</td>
        `;

        tr.innerHTML = html;
        fragment.appendChild(tr);
      });
    });

    tbody.appendChild(fragment);
  }
}

// 5. App Initialization
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("loginForm")) {
    new AuthController();
  }

  if (document.getElementById("sectorsContainer")) {
    new SectorsRenderer();
  }

  if (document.getElementById("tableBody") || document.getElementById("clientsGrid")) {
    window.dashboardController = new DashboardController();
  }

  if (document.getElementById("lateTableBody")) {
    new LatePaymentsController();
  }

  if (document.getElementById("arrivedTableBody")) {
    new CurrentMonthDuesController();
  }

  // Prevent number inputs from changing values on scroll
  document.addEventListener("wheel", (e) => {
    if (document.activeElement.type === "number") {
      document.activeElement.blur();
    }
  });
});
