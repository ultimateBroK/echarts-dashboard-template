// Elasticsearch configuration
const ELASTICSEARCH_URL = 'http://124.158.5.222:9400/report_test/_search/';

// Performance optimization configuration
const PERFORMANCE_CONFIG = {
    ENABLE_ANIMATIONS: true, // Enable professional animations with Motion.js
    DEBOUNCE_DELAY: 150, // Faster response time
    MAX_CONCURRENT_CHARTS: 3, // Reduce concurrent charts for better performance
    CACHE_TTL: 300000, // 5 minute cache TTL for better performance
    LAZY_LOAD_ENABLED: true, // Enable lazy loading
    CHART_RENDER_DELAY: 25, // Faster rendering
    BATCH_SIZE: 2, // Smaller batch size for smoother rendering
    USE_CANVAS_RENDERER: true, // Force canvas renderer for better performance
    ENABLE_PROGRESSIVE_RENDERING: true, // Enable progressive rendering
    PRIORITIZE_VISIBLE_CHARTS: true, // Only render visible charts first
    DEFER_HIDDEN_CHARTS: true // Defer hidden chart rendering
};

// Global variables
let charts = {};
let lastFetchedData = null;
let dataCache = new Map();
let chartObserver = null;
let isDataFetching = false;
let resizeTimeout = null;
let lazyLoadObserver = null;
let initializedTabs = new Set(); // Track initialized tabs
let pageVisible = true; // Track page visibility
let chartRenderQueue = []; // Queue for chart rendering
let isProcessingQueue = false;
let autoRefreshInterval = null;

// Global text style configuration for consistent text rendering
const GLOBAL_TEXT_STYLE = {
    textShadowBlur: 0,
    textShadowColor: 'transparent',
    textShadowOffsetX: 0,
    textShadowOffsetY: 0
};

// Animation configurations for motion.js
const ANIMATION_CONFIG = {
    duration: PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.8 : 0,
    ease: [0.4, 0, 0.2, 1],
    stagger: PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.1 : 0,
    chartsStagger: PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.15 : 0
};

// Chart entrance animations with motion.js
function animateChartEntrance() {
    // Skip animations if disabled for performance
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS) {
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach(container => {
            container.style.opacity = '1';
            container.style.visibility = 'visible';
        });
        return;
    }

    if (typeof Motion === 'undefined') {
        console.log('Motion.js not loaded, skipping animations');
        return;
    }

    try {
        const chartContainers = document.querySelectorAll('.chart-container');
        chartContainers.forEach((container, index) => {
            // Ensure container is visible first
            container.style.opacity = '1';
            container.style.visibility = 'visible';

            Motion.animate(container, {
                y: [50, 0],
                scale: [0.95, 1],
                opacity: [0.3, 1]
            }, {
                duration: ANIMATION_CONFIG.duration,
                ease: ANIMATION_CONFIG.ease,
                delay: index * ANIMATION_CONFIG.stagger
            });
        });

        // Trigger chart elements animation after delay
        setTimeout(() => {
            animateChartElements();
        }, 200);
    } catch (error) {
        console.log('Animation error:', error);
    }
}

// Chart elements animation with motion.js
function animateChartElements() {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') return;

    try {
        const charts = document.querySelectorAll('.chart');
        charts.forEach((chart, index) => {
            Motion.animate(chart, {
                scale: [0.98, 1],
                opacity: [0.7, 1]
            }, {
                duration: 0.6,
                ease: [0.68, -0.55, 0.265, 1.55],
                delay: index * 0.1
            });
        });
    } catch (error) {
        console.log('Chart elements animation error:', error);
    }
}

// Enhanced tab switching function with immediate chart dimension fixes
function showTab(tabName) {
    console.log(`🔄 Switching to tab: ${tabName}`);

    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Show target tab
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) {
        targetTab.classList.add('active');
        console.log(`✅ Tab ${tabName} activated`);

        // Update URL hash
        window.location.hash = tabName;

        // Immediately fix chart dimensions to prevent stretching
        const tabCharts = CHARTS_BY_TAB[tabName] || [];
        tabCharts.forEach(chartId => {
            const element = document.getElementById(chartId);
            if (element) {
                // Force proper dimensions immediately
                const container = element.closest('.chart-container');
                if (container) {
                    container.style.height = 'auto';
                    container.style.minHeight = '450px';
                    container.style.maxHeight = '600px';
                }
                element.style.height = '400px';
                element.style.minHeight = '400px';
                element.style.maxHeight = '500px';
                element.style.width = '100%';
            }
        });

        // Then resize and update charts after DOM stabilizes
        setTimeout(() => {
            resizeAndUpdateChartsForTab(`${tabName}-tab`);
        }, 100); // Reduced delay for faster response

        // Final check and fix after a bit more time
        setTimeout(() => {
            checkAndFixChartsInTab(tabName);
        }, 300);

    } else {
        console.error(`❌ Tab element not found: ${tabName}-tab`);
    }
}

// Optimized tab switching with performance enhancements
function animateTabSwitch(activeTabId) {
    // Use requestAnimationFrame for smooth performance
    requestAnimationFrame(() => {
        // Simple and reliable tab switching - let CSS handle the animation
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });

        const newTab = document.getElementById(activeTabId);
        if (newTab) {
            newTab.classList.add('active');

            // Use shorter timeout for better performance
            setTimeout(() => {
                resizeAndUpdateChartsForTab(activeTabId);
            }, 300); // Reduced from 450ms for snappier response
        } else {
            console.warn(`Tab element with id '${activeTabId}' not found`);
        }
    });
}

// Fixed chart resize and update function with proper height constraints
function resizeAndUpdateChartsForTab(activeTabId) {
    // Get only charts that are in the current tab
    const currentTabElement = document.getElementById(activeTabId);
    if (!currentTabElement) return;

    const chartsInTab = currentTabElement.querySelectorAll('.chart');
    const chartIdsInTab = Array.from(chartsInTab).map(chart => chart.id).filter(id => id);

    console.log(`🔧 Resizing ${chartIdsInTab.length} charts for tab: ${activeTabId}`);

    // Resize only visible charts with proper height constraints
    let resizePromises = [];
    chartIdsInTab.forEach(chartId => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            const promise = new Promise(resolve => {
                try {
                    const element = document.getElementById(chartId);
                    if (element) {
                        // Force proper container dimensions first
                        const container = element.closest('.chart-container');
                        if (container) {
                            // Reset any stretched heights
                            container.style.height = 'auto';
                            element.style.height = '400px'; // Fixed height
                            element.style.minHeight = '400px';
                            element.style.maxHeight = '500px'; // Prevent excessive stretching
                        }

                        // Wait for DOM to update
                        setTimeout(() => {
                            const width = element.offsetWidth || 600;
                            const height = Math.min(element.offsetHeight || 400, 500); // Cap height at 500px

                            console.log(`📐 Resizing chart ${chartId}: ${width}x${height}`);

                            charts[chartId].resize({
                                width: width,
                                height: height,
                                silent: true // Prevent resize animation conflicts
                            });
                            resolve();
                        }, 50);
                    } else {
                        resolve();
                    }
                } catch (error) {
                    console.error(`Error resizing chart ${chartId}:`, error);
                    resolve();
                }
            });
            resizePromises.push(promise);
        }
    });

    // Update charts after resize is complete
    Promise.all(resizePromises).then(() => {
        if (lastFetchedData) {
            console.log(`📊 Updating ${chartIdsInTab.length} charts for tab: ${activeTabId}`);
            updateAllChartsEnhanced(lastFetchedData);
        }
    });
}

// Animate chart containers in specific tab with motion.js
function animateChartContainers(tabSelector) {
    if (typeof Motion === 'undefined') return;

    try {
        const containers = document.querySelectorAll(`${tabSelector} .chart-container`);
        containers.forEach((container, index) => {
            Motion.animate(container, {
                scale: [0.97, 1],
                opacity: [0.8, 1]
            }, {
                duration: 0.5,
                delay: index * 0.08,
                ease: [0.68, -0.55, 0.265, 1.55]
            });
        });
    } catch (error) {
        console.log('Chart containers animation error:', error);
    }
}

// Improved loading state with better performance
function showAdvancedLoading(chartId) {
    // Use ECharts built-in loading instead
    if (charts[chartId]) {
        charts[chartId].showLoading('default', {
            text: 'Đang tải dữ liệu...',
            color: '#64c8ff',
            textColor: '#ffffff',
            maskColor: 'rgba(10, 10, 15, 0.8)',
            zlevel: 0,
            fontSize: 12,
            showSpinner: true,
            spinnerRadius: 12,
            lineWidth: 2
        });
    }
}

// Show loading for tab with performance optimization
function showTabLoading(tabName) {
    const tabCharts = CHARTS_BY_TAB[tabName] || [];
    console.log(`Showing loading for ${tabCharts.length} charts in tab: ${tabName}`);

    // Show loading for each chart in batch
    tabCharts.forEach((chartId, index) => {
        setTimeout(() => {
            showAdvancedLoading(chartId);
        }, index * 10); // Very fast stagger for loading indicators
    });
}

// Hide loading for tab
function hideTabLoading(tabName) {
    const tabCharts = CHARTS_BY_TAB[tabName] || [];
    tabCharts.forEach(chartId => {
        if (charts[chartId]) {
            charts[chartId].hideLoading();
        }
    });
}

// Enhanced chart update animation with motion.js for data refresh
function animateChartUpdate(chartId) {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') return;

    const chartElement = document.getElementById(chartId);
    if (!chartElement) return;

    try {
        // Create a smooth data refresh animation
        Motion.animate(chartElement, {
            scale: [1, 1.03, 1],
            opacity: [1, 0.7, 1]
        }, {
            duration: 0.6,
            ease: [0.68, -0.55, 0.265, 1.55]
        });

        // Add a subtle glow effect
        Motion.animate(chartElement, {
            filter: ['brightness(100%)', 'brightness(110%)', 'brightness(100%)']
        }, {
            duration: 0.8,
            ease: 'easeInOut'
        });
    } catch (error) {
        console.log('Chart update animation error:', error);
    }
}

// Enhanced button click animation with motion.js
function animateButtonClick(element) {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') return;

    try {
        // Primary scale animation
        Motion.animate(element, {
            scale: [1, 0.96, 1.02, 1]
        }, {
            duration: 0.3,
            ease: [0.25, 0.46, 0.45, 0.94]
        });

        // Subtle color pulse for refresh button
        if (element.id === 'refreshData') {
            Motion.animate(element, {
                backgroundColor: ['var(--primary-color)', 'var(--secondary-color)', 'var(--primary-color)']
            }, {
                duration: 0.4,
                ease: 'easeInOut'
            });
        }
    } catch (error) {
        console.log('Button animation error:', error);
    }
}

// Animation for data refresh process
function animateDataRefresh() {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') return;

    try {
        // Animate all visible charts with staggered timing
        const visibleCharts = document.querySelectorAll('.chart-container:not([style*="display: none"])');

        visibleCharts.forEach((container, index) => {
            // Staggered fade and scale animation
            Motion.animate(container, {
                opacity: [1, 0.5, 1],
                scale: [1, 0.98, 1],
                y: [0, -5, 0]
            }, {
                duration: 0.8,
                delay: index * 0.1,
                ease: [0.4, 0, 0.2, 1]
            });
        });

        // Animate stats cards
        const statsCards = document.querySelectorAll('.stat-card');
        statsCards.forEach((card, index) => {
            Motion.animate(card, {
                scale: [1, 1.05, 1],
                rotate: [0, 1, 0]
            }, {
                duration: 0.5,
                delay: index * 0.1,
                ease: 'easeInOut'
            });
        });

        console.log('🎬 Data refresh animation started');
    } catch (error) {
        console.log('Data refresh animation error:', error);
    }
}

// Counter animation for statistics
function animateStatsCounter(element, targetValue, duration = 1000) {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') {
        // Fallback without animation
        element.textContent = targetValue.toLocaleString();
        return;
    }

    try {
        const startValue = parseInt(element.textContent.replace(/[^\d]/g, '')) || 0;
        const difference = targetValue - startValue;

        Motion.animate(
            { value: startValue },
            { value: targetValue },
            {
                duration: duration / 1000,
                ease: 'easeOut',
                onUpdate: (latest) => {
                    const currentValue = Math.round(latest.value);
                    element.textContent = currentValue.toLocaleString();
                },
                onComplete: () => {
                    // Ensure final value is accurate
                    element.textContent = targetValue.toLocaleString();

                    // Add a subtle scale effect when complete
                    Motion.animate(element, {
                        scale: [1, 1.1, 1]
                    }, {
                        duration: 0.3,
                        ease: 'easeInOut'
                    });
                }
            }
        );
    } catch (error) {
        console.log('Stats counter animation error:', error);
        // Fallback
        element.textContent = targetValue.toLocaleString();
    }
}

// Loading spinner animation
function animateLoadingSpinner(show = true) {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') return;

    try {
        const spinners = document.querySelectorAll('.loading-spinner, [class*="loading"]');

        spinners.forEach(spinner => {
            if (show) {
                Motion.animate(spinner, {
                    opacity: [0, 1],
                    scale: [0.8, 1],
                    rotate: [0, 360]
                }, {
                    duration: 0.5,
                    ease: 'easeOut'
                });
            } else {
                Motion.animate(spinner, {
                    opacity: [1, 0],
                    scale: [1, 0.8]
                }, {
                    duration: 0.3,
                    ease: 'easeIn'
                });
            }
        });
    } catch (error) {
        console.log('Loading spinner animation error:', error);
    }
}

// Animation control functions
function toggleAnimations(enable = null) {
    // Toggle or set animation state
    if (enable === null) {
        PERFORMANCE_CONFIG.ENABLE_ANIMATIONS = !PERFORMANCE_CONFIG.ENABLE_ANIMATIONS;
    } else {
        PERFORMANCE_CONFIG.ENABLE_ANIMATIONS = enable;
    }

    // Update ANIMATION_CONFIG
    ANIMATION_CONFIG.duration = PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.8 : 0;
    ANIMATION_CONFIG.stagger = PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.1 : 0;
    ANIMATION_CONFIG.chartsStagger = PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 0.15 : 0;

    console.log(`🎬 Animations ${PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 'enabled' : 'disabled'}`);

    // Show visual feedback
    const statusMsg = document.createElement('div');
    statusMsg.textContent = `Animations ${PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 'Enabled' : 'Disabled'}`;
    statusMsg.style.cssText = `
        position: fixed; top: 20px; right: 20px; z-index: 9999;
        background: linear-gradient(135deg, #64c8ff, #00ffc8);
        color: white; padding: 12px 20px; border-radius: 8px;
        font-weight: 600; font-family: Inter, sans-serif;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    document.body.appendChild(statusMsg);

    // Remove after 3 seconds
    setTimeout(() => {
        if (statusMsg.parentElement) {
            statusMsg.remove();
        }
    }, 3000);
}

// Enhanced welcome animation sequence
function playWelcomeAnimations() {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') {
        console.log('Welcome animations skipped - Motion.js not available or disabled');
        return;
    }

    try {
        console.log('🎬 Starting welcome animation sequence...');

        // 1. Animate sidebar
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            Motion.animate(sidebar, {
                x: [-260, 0],
                opacity: [0, 1]
            }, {
                duration: 1,
                ease: [0.68, -0.55, 0.265, 1.55]
            });
        }

        // 2. Animate main content
        const mainContent = document.querySelector('.main-content');
        if (mainContent) {
            Motion.animate(mainContent, {
                x: [50, 0],
                opacity: [0, 1]
            }, {
                duration: 1.2,
                delay: 0.3,
                ease: [0.4, 0, 0.2, 1]
            });
        }

        // 3. Animate header stats
        const statsCards = document.querySelectorAll('.stat-card, .stats-item');
        statsCards.forEach((card, index) => {
            Motion.animate(card, {
                y: [-30, 0],
                opacity: [0, 1],
                scale: [0.9, 1]
            }, {
                duration: 0.8,
                delay: 0.5 + index * 0.1,
                ease: 'easeOut'
            });
        });

        // 4. Start chart entrance animations
        setTimeout(() => {
            animateChartEntrance();
        }, 800);

        console.log('✨ Welcome animations completed');
    } catch (error) {
        console.log('Welcome animation error:', error);
    }
}

// Floating particles animation (disabled for performance)
function createFloatingParticles() {
    console.log('Floating particles disabled for better chart performance');
    // Disabled to prevent interference with chart display
    return;
}

// Initialize components in proper sequence to prevent race conditions
async function initializeComponentsSequentially() {
    console.log('Initializing dashboard components...');

    try {
        // Step 1: Initialize charts first
        await new Promise(resolve => {
            initializeCharts();
            setTimeout(resolve, 100); // Allow charts to initialize
        });

        // Step 2: Initialize tabs and UI components
        await new Promise(resolve => {
            // initializeTabs(); // DISABLED - using initializeTabNavigation instead
            console.log('Tab initialization skipped - handled by initializeTabNavigation');
            initializeExportButtons();
            initializeSidebarToggle();
            initializeSidebarCollapse();
            setTimeout(resolve, 50); // Allow UI to initialize
        });

        // Step 3: Initialize animations only if Motion.js is loaded
        if (typeof Motion !== 'undefined') {
            try {
                console.log('Initializing professional Motion.js animations...');
                playWelcomeAnimations();
                createEnhancedFloatingParticles();
            } catch (error) {
                console.log('Animation initialization error:', error);
            }
        } else {
            console.log('Motion.js not loaded, animations disabled');
        }

        // Step 4: Fetch and update data last
        await new Promise(resolve => {
            setTimeout(() => {
                fetchDataAndUpdateCharts();
                resolve();
            }, 200);
        });

        // Step 5: Fallback - ensure all critical charts are initialized
        setTimeout(() => {
            ensureAllChartsInitialized();

            // Step 6: Force initial data load for all visible charts
            setTimeout(() => {
                forceInitialDataLoad();

                // Step 7: Performance check
                setTimeout(() => {
                    checkPerformance();
                }, 100);
            }, 300);
        }, 500);

        console.log('Dashboard initialization completed successfully');
    } catch (error) {
        console.error('Error during dashboard initialization:', error);
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 DOM Content Loaded - Starting initialization...');

    // Fix grid classes for proper responsive layout
    fixGridClasses();

    // Initialize core functions first
    console.log('🔧 Initializing sidebar...');
    initializeSidebarCollapse();

    // Initialize tab navigation immediately
    console.log('🔧 Initializing tabs...');
    initializeTabNavigation();

    // Initialize components in proper sequence to prevent race conditions
    console.log('🔧 Starting sequential initialization...');
    initializeComponentsSequentially();

    // Remove duplicate tab initialization later in the code
    console.log('⚠️ Note: Duplicate tab initialization will be cleaned up');

    // Event listeners with professional animations
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', function(e) {
            // Professional button animation
            animateButtonClick(e.target);

            // Start data refresh animation
            animateDataRefresh();

            // Force refresh all data and charts
            console.log('🔄 Refreshing all data with animations...');
            const mockData = generateEnhancedMockData();
            lastFetchedData = mockData;

            // Animate charts update
            setTimeout(() => {
                forceUpdateAllCharts(mockData);
                updateStatsWithAnimation(mockData.aggregations);
                updateLastUpdateTime();
                console.log('✅ Data refresh completed with animations');
            }, 200); // Small delay to let initial animation start
        });
    } else {
        console.warn('Refresh button not found');
    }

    const exportBtn = document.getElementById('exportExcel');
    if (exportBtn) {
        exportBtn.addEventListener('click', function(e) {
            // Professional button animation
            animateButtonClick(e.target);

            // Add export loading animation
            if (PERFORMANCE_CONFIG.ENABLE_ANIMATIONS && typeof Motion !== 'undefined') {
                try {
                    // Create download icon animation
                    Motion.animate(e.target, {
                        rotate: [0, 360],
                        scale: [1, 1.1, 1]
                    }, {
                        duration: 0.8,
                        ease: 'easeInOut'
                    });
                } catch (error) {
                    console.log('Export animation error:', error);
                }
            }

            exportAllToExcel();
        });
    } else {
        console.warn('Export button not found');
    }

    // Auto-refresh every 5 minutes (only when page is visible)
    autoRefreshInterval = setInterval(() => {
        if (pageVisible && !isDataFetching) {
            fetchDataAndUpdateCharts();
        } else {
            console.log('Skipping auto-refresh: page not visible or fetch in progress');
        }
    }, 5 * 60 * 1000);

    // Initialize tools dropdown menu
    initializeToolsMenu();
});

// Cleanup function for memory management
function cleanupResources() {
    console.log('Cleaning up resources...');

    // Clear auto-refresh interval
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }

    // Clear resize timeout
    if (resizeTimeout) {
        clearTimeout(resizeTimeout);
        resizeTimeout = null;
    }

    // Dispose all charts
    Object.keys(charts).forEach(chartId => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            charts[chartId].dispose();
        }
    });
    charts = {};

    // Clear observers
    if (chartObserver) {
        chartObserver.disconnect();
        chartObserver = null;
    }

    if (lazyLoadObserver) {
        lazyLoadObserver.disconnect();
        lazyLoadObserver = null;
    }

    // Clear cache
    dataCache.clear();

    console.log('Resources cleaned up successfully');
}

// Add cleanup on page unload
window.addEventListener('beforeunload', cleanupResources);

// Handle global errors gracefully
window.addEventListener('error', function(e) {
    // Ignore extension-related errors
    if (e.message && e.message.includes('Permission denied')) {
        return;
    }

    // Log meaningful errors only
    if (e.message && !e.message.includes('extension') && !e.message.includes('moz-extension')) {
        console.warn('Dashboard error:', e.message);
    }
});

// Fix grid classes for proper responsive layout
function fixGridClasses() {
    // Fix detailed tab grids
    const detailedGrids = document.querySelectorAll('#detailed-tab .chart-grid');
    detailedGrids.forEach(grid => {
        grid.className = 'chart-grid detailed';
    });

    // Fix analytics tab grids
    const analyticsGrids = document.querySelectorAll('#analytics-tab .chart-grid');
    analyticsGrids.forEach(grid => {
        grid.className = 'chart-grid analytics';
    });
}

// Initialize Intersection Observer for lazy loading
function initializeLazyLoading() {
    // For now, let's disable lazy loading and use standard initialization
    // to avoid compatibility issues
    console.log('Initializing charts with standard method...');
    initializeCharts();
}

// Chart configurations by tab with priority
const CHARTS_BY_TAB = {
    overview: ['sourceChart', 'enterpriseChart', 'typeChart', 'severityChart', 'targetChart', 'statusChart', 'routeChart', 'contentChart'],
    detailed: ['enterpriseTypeMatrix', 'timeTrendChart', 'severityTypeChart', 'riskAnalysisChart', 'routeMonthlyChart'],
    analytics: ['cnlxAnalytics', 'garaAnalytics', 'nvpvAnalytics', 'praiseBySourceChart', 'praiseByEnterpriseChart', 'responseRateChart', 'responseTimeChart', 'networkAnalysisChart', 'heatmapChart', 'correlationChart'],
    exports: []
};

// High priority charts (render first)
const HIGH_PRIORITY_CHARTS = ['sourceChart', 'enterpriseChart', 'typeChart', 'severityChart'];

// Fallback function to ensure all charts are initialized
function ensureAllChartsInitialized() {
    console.log('🔍 Checking all charts are initialized...');

    // Get all chart IDs from all tabs
    const allChartIds = Object.values(CHARTS_BY_TAB).flat();

    let missingCharts = [];
    allChartIds.forEach(chartId => {
        if (!charts[chartId] || charts[chartId].isDisposed()) {
            missingCharts.push(chartId);
        }
    });

    // Also check for elements that exist but charts failed to initialize
    let errorCharts = [];
    allChartIds.forEach(chartId => {
        const element = document.getElementById(chartId);
        if (element && (!charts[chartId] || charts[chartId].isDisposed())) {
            try {
                // Try to get chart instance
                if (charts[chartId] && !charts[chartId].isDisposed()) {
                    charts[chartId].getOption();
                }
            } catch (error) {
                errorCharts.push(chartId);
            }
        }
    });

    if (missingCharts.length > 0) {
        console.log(`🚨 Found ${missingCharts.length} missing charts:`, missingCharts);
        console.log('⚡ Initializing missing charts...');

        missingCharts.forEach((chartId, index) => {
            setTimeout(() => {
                console.log(`🔄 Re-initializing: ${chartId}`);
                initializeChart(chartId);
            }, index * 100); // Increased delay for stability
        });
    }

    if (errorCharts.length > 0) {
        console.log(`🔧 Found ${errorCharts.length} error charts:`, errorCharts);

        errorCharts.forEach((chartId, index) => {
            setTimeout(() => {
                console.log(`🔧 Fixing error chart: ${chartId}`);
                if (charts[chartId]) {
                    charts[chartId].dispose();
                }
                initializeChart(chartId);
            }, (missingCharts.length + index) * 100);
        });
    }

    if (missingCharts.length === 0 && errorCharts.length === 0) {
        console.log('✅ All charts are properly initialized');
    }
}

// Force initial data load for all visible charts
function forceInitialDataLoad() {
    console.log('🔄 Force loading initial data for all visible charts...');

    const activeTab = getActiveTabName();
    const activeCharts = CHARTS_BY_TAB[activeTab] || [];

    // Generate mock data if not already available
    if (!lastFetchedData) {
        console.log('📊 Generating mock data for initial load...');
        lastFetchedData = generateEnhancedMockData();
    }

    // Update active charts with data
    activeCharts.forEach(chartId => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            console.log(`📈 Updating chart: ${chartId}`);
            updateChartByType(chartId, lastFetchedData);
        }
    });

    // Update stats
    if (lastFetchedData && lastFetchedData.aggregations) {
        updateStats(lastFetchedData.aggregations);
        updateLastUpdateTime();
    }

    console.log('✅ Initial data load completed');
}

// Debug function to check charts status
function debugChartsStatus() {
    console.log('📊 ==> CHARTS DEBUG STATUS <==');

    const allChartIds = Object.values(CHARTS_BY_TAB).flat();
    const activeTab = getActiveTabName();

    console.log(`🎯 Active tab: ${activeTab}`);
    console.log(`📋 Total charts defined: ${allChartIds.length}`);
    console.log(`📊 Charts initialized: ${Object.keys(charts).length}`);
    console.log(`🔧 Initialized tabs: ${Array.from(initializedTabs).join(', ')}`);

    // Check each tab
    Object.entries(CHARTS_BY_TAB).forEach(([tabName, chartIds]) => {
        console.log(`\n📂 Tab: ${tabName} (${chartIds.length} charts)`);

        chartIds.forEach(chartId => {
            const element = document.getElementById(chartId);
            const chart = charts[chartId];

            let status = '❌ Missing';
            if (chart && !chart.isDisposed()) {
                status = '✅ Ready';
            } else if (chart && chart.isDisposed()) {
                status = '⚠️ Disposed';
            } else if (element) {
                status = '🔄 Element exists, chart not initialized';
            }

            console.log(`  - ${chartId}: ${status}`);
        });
    });

    console.log('📊 ==> END DEBUG STATUS <==');
}

// Performance check function
function checkPerformance() {
    if (window.performance && window.performance.timing) {
        const timing = window.performance.timing;
        const loadTime = timing.loadEventEnd - timing.navigationStart;

        // Only log if we have a valid load time
        if (loadTime > 0 && loadTime < 30000) { // Reasonable load time (< 30 seconds)
            console.log(`⚡ Dashboard load time: ${loadTime}ms`);

            // Performance assessment
            if (loadTime < 2000) {
                console.log('🟢 Excellent performance');
            } else if (loadTime < 5000) {
                console.log('🟡 Good performance');
            } else {
                console.log('🔴 Consider optimization');
            }
        }
    }

    // Check chart rendering performance
    const chartsCount = Object.keys(charts).length;
    const initializedTabsCount = initializedTabs.size;

    console.log(`📊 Performance summary:`);
    console.log(`  - Charts initialized: ${chartsCount}`);
    console.log(`  - Tabs initialized: ${initializedTabsCount}`);
    console.log(`  - Memory usage: ${(performance.memory?.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB` || 'N/A');
}

// Initialize all ECharts instances with performance optimizations
function initializeCharts() {
    // Check if ECharts library is loaded
    if (typeof echarts === 'undefined') {
        console.error('ECharts library is not loaded. Charts cannot be initialized.');
        showError('ECharts library không được tải. Vui lòng tải lại trang.');
        return;
    }

    if (PERFORMANCE_CONFIG.LAZY_LOAD_ENABLED) {
        // Initialize charts for the active tab and ensure all tabs have basic setup
        const activeTab = getActiveTabName();
        console.log(`Initializing active tab: ${activeTab}`);
        initializeTabCharts(activeTab);

        // Pre-initialize overview charts if not already active (fallback)
        if (activeTab !== 'overview') {
            console.log('Pre-initializing overview charts as fallback');
            initializeTabCharts('overview');
        }
    } else {
        // Initialize all charts (old behavior)
        const chartIds = [
            'sourceChart', 'enterpriseChart', 'typeChart',
            'severityChart', 'targetChart', 'statusChart',
            'routeChart', 'contentChart',
            // New detailed report charts
            'enterpriseTypeMatrix', 'timeTrendChart', 'severityTypeChart', 'riskAnalysisChart',
            'routeMonthlyChart', 'cnlxAnalytics', 'garaAnalytics', 'nvpvAnalytics',
            'praiseBySourceChart', 'praiseByEnterpriseChart', 'responseRateChart', 'responseTimeChart',
            'networkAnalysisChart', 'heatmapChart', 'correlationChart'
        ];

        chartIds.forEach(id => initializeChart(id));
    }
}

// Initialize charts for a specific tab
function initializeTabCharts(tabName) {
    if (initializedTabs.has(tabName)) {
        console.log(`Tab ${tabName} already initialized`);
        return;
    }

    const tabCharts = CHARTS_BY_TAB[tabName] || [];
    console.log(`Initializing ${tabCharts.length} charts for tab: ${tabName}`);

    // Separate high priority and regular charts
    const highPriorityCharts = tabCharts.filter(chartId => HIGH_PRIORITY_CHARTS.includes(chartId));
    const regularCharts = tabCharts.filter(chartId => !HIGH_PRIORITY_CHARTS.includes(chartId));

    // Initialize high priority charts first (no delay)
    highPriorityCharts.forEach(chartId => {
        initializeChart(chartId);
    });

    // Initialize regular charts with progressive delay
    regularCharts.forEach((chartId, index) => {
        setTimeout(() => {
            initializeChart(chartId);
        }, (index + 1) * PERFORMANCE_CONFIG.CHART_RENDER_DELAY);
    });

    initializedTabs.add(tabName);
}

// Initialize a single chart
function initializeChart(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Chart element not found: ${id}`);
        return;
    }

    if (charts[id]) {
        console.log(`Chart ${id} already initialized`);
        return;
    }

    try {
        // Check if element has proper dimensions or is in hidden tab
        let width = element.offsetWidth;
        let height = element.offsetHeight;

        if (width === 0 || height === 0) {
            // For hidden tabs, use intelligent default sizes based on container class
            const isLargeChart = element.classList.contains('chart-large');
            const isFullWidth = element.parentElement?.classList.contains('full-width');

            if (isFullWidth) {
                element.style.width = '100%';
                element.style.height = '500px';
                width = 1200;
                height = 500;
            } else if (isLargeChart) {
                element.style.width = '100%';
                element.style.height = '480px';
                width = 800;
                height = 480;
            } else {
                element.style.width = '100%';
                element.style.height = '380px';
                width = 600;
                height = 380;
            }

            console.log(`📐 Chart ${id} in hidden tab - using smart defaults: ${width}x${height}`);
        }

        charts[id] = echarts.init(element, null, {
            renderer: 'canvas',
            useDirtyRect: true,
            useCoarsePointer: true,
            pointerSize: 2,
            ssr: false,
            width: width,
            height: height,
            devicePixelRatio: Math.min(window.devicePixelRatio || 1, 2) // Limit pixel ratio for performance
        });

        // Configure performance settings
        charts[id].setOption({
            animation: PERFORMANCE_CONFIG.ENABLE_ANIMATIONS,
            animationDuration: PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 200 : 0,
            animationEasing: 'cubicOut',
            lazyUpdate: true,
            progressive: PERFORMANCE_CONFIG.ENABLE_PROGRESSIVE_RENDERING ? 200 : 0,
            progressiveThreshold: PERFORMANCE_CONFIG.ENABLE_PROGRESSIVE_RENDERING ? 1000 : 0,
            hoverLayerThreshold: 8000,
            useUTC: true
        });

        showLoadingState(id);
        console.log(`Successfully initialized chart: ${id}`);
    } catch (error) {
        console.error(`Error initializing chart ${id}:`, error);
    }
}

// Get active tab name
function getActiveTabName() {
    const activeTab = document.querySelector('.tab-content.active');
    if (activeTab) {
        const tabId = activeTab.id;
        return tabId.replace('-tab', '');
    }
    return 'overview'; // default
}

// Utility function to check if element is visible
function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

// Optimized resize handler with debouncing and container checking
function initializeResizeHandler() {
    window.addEventListener('resize', function() {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('Resizing charts after window resize');

            // Only resize visible charts
            const activeTab = getActiveTabName();
            const visibleCharts = CHARTS_BY_TAB[activeTab] || [];

            visibleCharts.forEach(chartId => {
                const chart = charts[chartId];
                if (chart && !chart.isDisposed()) {
                    try {
                        const element = document.getElementById(chartId);
                        if (element && element.offsetWidth > 0 && element.offsetHeight > 0) {
                            chart.resize({
                                width: element.offsetWidth,
                                height: element.offsetHeight
                            });
                        }
                    } catch (error) {
                        console.error(`Error resizing chart ${chartId}:`, error);
                    }
                }
            });
        }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);
    });
}

// Sidebar toggle functionality
// Legacy function - now handled by initializeSidebarCollapse()
function initializeSidebarToggle() {
    console.log('initializeSidebarToggle() - delegated to initializeSidebarCollapse()');
    const sidebar = document.querySelector('.sidebar');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (sidebar) {
        // Close sidebar when clicking overlay (mobile)
        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', function() {
                sidebar.classList.remove('show');
                sidebarOverlay.classList.remove('show');
            });
        }

        // Handle window resize
        window.addEventListener('resize', function() {
            const isMobile = window.innerWidth <= 768;
            if (!isMobile) {
                // Reset mobile classes on desktop
                sidebar.classList.remove('show');
                if (sidebarOverlay) {
                    sidebarOverlay.classList.remove('show');
                }
            }

            // Optimize layout on resize
            setTimeout(() => {
                optimizeChartLayout();
            }, 100);
        });

        // Handle keyboard shortcut (Ctrl+B)
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                if (typeof toggleSidebar === 'function') {
                    toggleSidebar();
                }
            }
        });

        console.log('Sidebar toggle initialized');
    } else {
        console.warn('Sidebar toggle button or sidebar not found');
    }
}

// Initialize tab navigation - MISSING FUNCTION!
function initializeTabNavigation() {
    console.log('🔗 Initializing tab navigation...');

    const menuLinks = document.querySelectorAll('.menu-link');
    console.log(`🔧 Found ${menuLinks.length} menu links`);

    menuLinks.forEach(menuLink => {
        menuLink.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = menuLink.getAttribute('data-tab');

            if (!targetTab) {
                console.error('❌ No data-tab attribute found');
                return;
            }

            console.log(`🔄 Switching to tab: ${targetTab}`);

            // Remove active class from all menu links
            menuLinks.forEach(link => link.classList.remove('active'));

            // Add active class to clicked menu link
            menuLink.classList.add('active');

            // Switch to the tab
            showTab(targetTab);
        });
    });

    // Initialize hash-based navigation
    function handleHashChange() {
        const hash = window.location.hash.substring(1);
        if (hash && Object.keys(CHARTS_BY_TAB).includes(hash)) {
            showTab(hash);

            // Update active menu link
            menuLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-tab') === hash);
            });
        }
    }

    // Handle hash changes
    window.addEventListener('hashchange', handleHashChange);

    // Initialize with current hash or default to overview
    const currentHash = window.location.hash.substring(1);
    if (currentHash && Object.keys(CHARTS_BY_TAB).includes(currentHash)) {
        showTab(currentHash);
    } else {
        showTab('overview');
        window.location.hash = 'overview';
    }

    console.log('✅ Tab navigation initialized');
}

// Global sidebar toggle function - MOVED OUT OF initializeSidebarCollapse
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');

    if (!sidebar || !mainContent) {
        console.warn('Sidebar or main content elements not found');
        return;
    }

    console.log('🔄 Toggling sidebar...');

    // Toggle collapsed state
    sidebar.classList.toggle('collapsed');

    // Update main content class and margin
    if (sidebar.classList.contains('collapsed')) {
        mainContent.classList.add('sidebar-collapsed');
        mainContent.style.marginLeft = '60px'; // --sidebar-collapsed-width
        console.log('📐 Sidebar collapsed');
    } else {
        mainContent.classList.remove('sidebar-collapsed');
        mainContent.style.marginLeft = '260px'; // --sidebar-width
        console.log('📐 Sidebar expanded');
    }

    // Resize charts after sidebar animation
    setTimeout(() => {
        // Force reflow first to ensure all CSS changes are applied
        document.body.offsetHeight;

        // Resize all visible charts with staggered timing for smooth experience
        Object.entries(charts).forEach(([chartId, chart], index) => {
            if (chart && !chart.isDisposed()) {
                setTimeout(() => {
                    try {
                        // Check if the chart's container is visible
                        const container = document.getElementById(chartId);
                        if (container && container.offsetParent !== null) {
                            chart.resize({
                                width: 'auto',
                                height: 'auto',
                                silent: true,
                                animation: {
                                    duration: 300,
                                    easing: 'cubicOut'
                                }
                            });
                        }
                    } catch (error) {
                        console.error(`Error resizing chart ${chartId}:`, error);
                    }
                }, index * 50); // Stagger resize by 50ms per chart
            }
        });

        console.log('Charts resized after sidebar toggle');
    }, 300);

    console.log('Sidebar toggled:', sidebar.classList.contains('collapsed') ? 'collapsed' : 'expanded');
}

// Initialize sidebar collapse functionality
function initializeSidebarCollapse() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');

    if (!sidebar || !mainContent) {
        console.warn('Sidebar or main content not found');
        return;
    }

    // Add click event to sidebar header toggle button
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleSidebar();
        });
        console.log('✅ Sidebar toggle button initialized');
    } else {
        console.warn('⚠️ Sidebar toggle button not found');
    }

    // Add click event to entire sidebar for toggle (except interactive elements)
    sidebar.addEventListener('click', function(e) {
        // Don't toggle if clicking on links, buttons, or other interactive elements
        if (!e.target.closest('.menu-link, .refresh-btn, .sidebar-toggle-btn')) {
            toggleSidebar();
        }
    });

    // Handle mobile sidebar overlay
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', function() {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
        });
        console.log('✅ Sidebar overlay initialized');
    }

    // Handle window resize for mobile responsiveness
    window.addEventListener('resize', function() {
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            // Reset mobile classes on desktop
            sidebar.classList.remove('show');
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('show');
            }
        }
    });

    // Add hover functionality for collapsed sidebar
    let hoverTimeout;

    sidebar.addEventListener('mouseenter', function() {
        if (sidebar.classList.contains('collapsed')) {
            // Clear any existing timeout
            clearTimeout(hoverTimeout);

            // Add hover class for CSS transitions
            sidebar.classList.add('hover-expanded');
        }
    });

    sidebar.addEventListener('mouseleave', function() {
        if (sidebar.classList.contains('collapsed')) {
            // Set timeout before removing hover class
            hoverTimeout = setTimeout(() => {
                sidebar.classList.remove('hover-expanded');
            }, 100); // Small delay to prevent flickering
        }
    });

    console.log('Sidebar collapse initialized with click-anywhere functionality');
}

// Optimize chart layout based on available space
function optimizeChartLayout() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const chartGrids = document.querySelectorAll('.chart-grid');

    if (!sidebar || !mainContent || !chartGrids.length) return;

    const sidebarWidth = sidebar.classList.contains('collapsed') ? 60 : 260;
    const availableWidth = window.innerWidth - sidebarWidth;

    chartGrids.forEach(grid => {
        const chartContainers = grid.querySelectorAll('.chart-container');
        const containerCount = chartContainers.length;

        // Calculate optimal columns based on available space
        let optimalColumns = 1;
        if (availableWidth >= 1400) {
            optimalColumns = Math.min(3, containerCount);
        } else if (availableWidth >= 1000) {
            optimalColumns = Math.min(2, containerCount);
        } else if (availableWidth >= 600) {
            optimalColumns = Math.min(2, containerCount);
        }

        // Apply dynamic grid columns
        grid.style.gridTemplateColumns = `repeat(${optimalColumns}, 1fr)`;

        // Handle full-width containers
        chartContainers.forEach(container => {
            if (container.classList.contains('full-width')) {
                container.style.gridColumn = '1 / -1';
            }

            // Ensure proper height for container
            container.style.minHeight = '500px';

            // Find chart element and update size
            const chart = container.querySelector('.chart');
            if (chart) {
                chart.style.height = '450px';
                chart.style.minHeight = '450px';
            }
        });
    });

    console.log(`Optimized layout for ${availableWidth}px width`);

    // Force chart resize after layout optimization
    setTimeout(() => {
        Object.entries(charts).forEach(([chartId, chart]) => {
            if (chart && !chart.isDisposed()) {
                try {
                    const element = document.getElementById(chartId);
                    if (element) {
                        chart.resize({
                            width: element.offsetWidth,
                            height: element.offsetHeight
                        });
                    }
                } catch (error) {
                    console.error(`Error resizing chart ${chartId} after layout optimization:`, error);
                }
            }
        });
    }, 100);
}

// Lazy loading implementation
function initializeLazyLoading() {
    if (!('IntersectionObserver' in window)) {
        console.log('IntersectionObserver not supported, loading all charts immediately');
        return;
    }

    const options = {
        root: null,
        rootMargin: '50px',
        threshold: 0.1
    };

    chartObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const chartId = entry.target.id;
                if (charts[chartId] && !charts[chartId].isDisposed()) {
                    // Chart is visible, ensure it's updated
                    const updateFunction = getChartUpdateFunction(chartId);
                    if (updateFunction && lastFetchedData) {
                        updateFunction(lastFetchedData);
                    }
                }
                chartObserver.unobserve(entry.target);
            }
        });
    }, options);

    // Observe all chart containers
    Object.keys(charts).forEach(chartId => {
        const element = document.getElementById(chartId);
        if (element) {
            chartObserver.observe(element);
        }
    });
}

// Get chart update function by ID
function getChartUpdateFunction(chartId) {
    const updateFunctions = {
        'sourceChart': updateSourceChart,
        'enterpriseChart': updateEnterpriseChart,
        'typeChart': updateTypeChart,
        'severityChart': updateSeverityChart,
        'targetChart': updateTargetChart,
        'statusChart': updateStatusChart,
        'routeChart': updateRouteChart,
        'contentChart': updateContentChart,
        // Additional charts for enhanced analytics
        'enterpriseTypeMatrix': updateEnterpriseTypeMatrix,
        'timeTrendChart': updateTimeTrendChart,
        'severityTypeChart': updateSeverityTypeChart,
        'riskAnalysisChart': updateRiskAnalysisChart,
        'routeMonthlyChart': updateRouteMonthlyChart,
        'cnlxAnalytics': updateTargetAnalysisCharts,
        'garaAnalytics': updateTargetAnalysisCharts,
        'nvpvAnalytics': updateTargetAnalysisCharts,
        'praiseBySourceChart': updatePraiseAnalysisCharts,
        'praiseByEnterpriseChart': updatePraiseAnalysisCharts,
        'responseRateChart': updateResponseAnalysisCharts,
        'responseTimeChart': updateResponseAnalysisCharts,
        'networkAnalysisChart': updateNetworkAnalysisChart,
        'heatmapChart': updateHeatmapChart,
        'correlationChart': updateCorrelationChart
    };

    return updateFunctions[chartId];
}

// Show loading state for charts
function showLoadingState(chartId) {
    if (charts[chartId]) {
        charts[chartId].showLoading('default', {
            text: 'Đang tải dữ liệu...',
            color: '#ffffff',
            textColor: '#ffffff',
            maskColor: 'rgba(0, 0, 0, 0.8)',
            zlevel: 0,
            fontSize: 16,
            fontWeight: 'normal'
        });
    }
}

// Hide loading state
function hideLoadingState(chartId) {
    if (charts[chartId]) {
        charts[chartId].hideLoading();
    }
}

// Fetch data from Elasticsearch with caching
async function fetchDataAndUpdateCharts() {
    // Prevent multiple simultaneous requests
    if (isDataFetching) {
        console.log('Data fetch already in progress, skipping...');
        return;
    }

    isDataFetching = true;

    try {
        console.log('Fetching data from Elasticsearch...');

        // Check cache first
        const cacheKey = 'elasticsearch_data';
        const cachedData = dataCache.get(cacheKey);
        const now = Date.now();

        if (cachedData && (now - cachedData.timestamp < PERFORMANCE_CONFIG.CACHE_TTL)) {
            console.log('Using cached data...');
            updateAllCharts(cachedData.data);
            isDataFetching = false;
            return;
        }

        // Enhanced Elasticsearch query with deeper analysis
        const query = {
            "size": 100, // Get some sample documents
            "query": {
                "match_all": {}
            },
            "aggs": {
                "nguon_agg": {
                    "terms": {
                        "field": "nguon.keyword",
                        "size": 10
                    }
                },
                "xi_nghiep_agg": {
                    "terms": {
                        "field": "xi_nghiep.keyword",
                        "size": 15
                    }
                },
                "loai_agg": {
                    "terms": {
                        "field": "loai.keyword",
                        "size": 10
                    }
                },
                "cap_do_agg": {
                    "terms": {
                        "field": "cap_do",
                        "size": 5
                    }
                },
                "doi_tuong_agg": {
                    "terms": {
                        "field": "doi_tuong.keyword",
                        "size": 10
                    }
                },
                "trang_thai_agg": {
                    "terms": {
                        "field": "trang_thai.keyword",
                        "size": 5
                    }
                },
                "tuyen_agg": {
                    "terms": {
                        "field": "tuyen.keyword",
                        "size": 20
                    }
                },
                "noi_dung_agg": {
                    "terms": {
                        "field": "noi_dung.keyword",
                        "size": 15
                    }
                },
                "total_records": {
                    "value_count": {
                        "field": "_id"
                    }
                },
                // Advanced aggregations for deep analysis
                "enterprise_type_matrix": {
                    "terms": {
                        "field": "xi_nghiep.keyword",
                        "size": 10
                    },
                    "aggs": {
                        "by_type": {
                            "terms": {
                                "field": "loai.keyword",
                                "size": 6
                            }
                        }
                    }
                },
                "severity_type_matrix": {
                    "terms": {
                        "field": "cap_do",
                        "size": 3
                    },
                    "aggs": {
                        "by_type": {
                            "terms": {
                                "field": "loai.keyword",
                                "size": 6
                            }
                        }
                    }
                },
                "target_analysis": {
                    "terms": {
                        "field": "doi_tuong.keyword",
                        "size": 5
                    },
                    "aggs": {
                        "by_source": {
                            "terms": {
                                "field": "nguon.keyword",
                                "size": 3
                            }
                        },
                        "by_severity": {
                            "terms": {
                                "field": "cap_do",
                                "size": 3
                            }
                        }
                    }
                },
                "time_analysis": {
                    "date_histogram": {
                        "field": "created_at",
                        "calendar_interval": "hour",
                        "min_doc_count": 1
                    }
                },
                "praise_analysis": {
                    "filter": {
                        "term": { "loai.keyword": "Khen ngợi" }
                    },
                    "aggs": {
                        "by_source": {
                            "terms": {
                                "field": "nguon.keyword",
                                "size": 3
                            }
                        },
                        "by_enterprise": {
                            "terms": {
                                "field": "xi_nghiep.keyword",
                                "size": 10
                            }
                        }
                    }
                }
            }
        };

        // If direct CORS call fails, we'll use mock data based on your provided statistics
        let data;
        try {
            const response = await axios.post(ELASTICSEARCH_URL, query, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            data = response.data;
        } catch (error) {
            console.warn('Direct Elasticsearch call failed, using mock data:', error.message);
            data = generateEnhancedMockData();
            console.log('Using enhanced mock data with full analytics support');
        }

        // Cache the data
        dataCache.set(cacheKey, {
            data: data,
            timestamp: now
        });

        lastFetchedData = data;
        updateAllChartsEnhanced(data);
        updateStats(data);
        updateLastUpdateTime();

        console.log('Data updated successfully');

    } catch (error) {
        console.error('Error fetching data:', error);
        showError('Lỗi khi tải dữ liệu: ' + error.message);
    } finally {
        isDataFetching = false;
    }
}

// Update all charts with optimized performance (calls enhanced version)
function updateAllCharts(data) {
    // Use requestAnimationFrame for smooth updates
    requestAnimationFrame(() => {
        updateAllChartsEnhanced(data);
    });
}

// Generate mock data based on provided statistics
function generateMockData() {
    return {
        aggregations: {
            total_records: { value: 10000 },
            nguon_agg: {
                buckets: [
                    { key: 'facebook', doc_count: 3440 },
                    { key: 'zalo', doc_count: 3312 },
                    { key: 'call', doc_count: 3248 }
                ]
            },
            xi_nghiep_agg: {
                buckets: [
                    { key: 'Buýt Cầu Bươu', doc_count: 1155 },
                    { key: 'Xí nghiệp Xe Khách Nam', doc_count: 1153 },
                    { key: 'Buýt nhanh BRT', doc_count: 1145 },
                    { key: 'Buýt 10-10', doc_count: 1127 },
                    { key: 'Công ty Cổ phần Xe Điện', doc_count: 1008 },
                    { key: 'Xí nghiệp Xe Khách Bắc', doc_count: 950 },
                    { key: 'Buýt Nội Bài', doc_count: 890 },
                    { key: 'Xe Khách Phương Nam', doc_count: 820 },
                    { key: 'Buýt Thăng Long', doc_count: 780 },
                    { key: 'Xe Buýt Hà Nội', doc_count: 672 }
                ]
            },
            loai_agg: {
                buckets: [
                    { key: 'Khác', doc_count: 1706 },
                    { key: 'Góp ý', doc_count: 1703 },
                    { key: 'Khen ngợi', doc_count: 1671 },
                    { key: 'Phản ánh', doc_count: 1650 },
                    { key: 'Khiếu nại', doc_count: 1635 },
                    { key: 'Báo cáo sự cố', doc_count: 1635 }
                ]
            },
            cap_do_agg: {
                buckets: [
                    { key: 2, doc_count: 4200 },
                    { key: 1, doc_count: 3400 },
                    { key: 3, doc_count: 2400 }
                ]
            },
            doi_tuong_agg: {
                buckets: [
                    { key: 'CNLX', doc_count: 3390 },
                    { key: 'GARA', doc_count: 3337 },
                    { key: 'NVPV', doc_count: 3273 }
                ]
            },
            trang_thai_agg: {
                buckets: [
                    { key: 'Đã xử lý', doc_count: 5012 },
                    { key: 'Đang xử lý', doc_count: 4988 }
                ]
            },
            tuyen_agg: {
                buckets: [
                    { key: 'BRT01', doc_count: 253 },
                    { key: '49', doc_count: 202 },
                    { key: '26', doc_count: 169 },
                    { key: '146', doc_count: 167 },
                    { key: '17', doc_count: 158 },
                    { key: '92', doc_count: 153 },
                    { key: '22A', doc_count: 149 },
                    { key: '15', doc_count: 144 },
                    { key: '12', doc_count: 143 },
                    { key: '34', doc_count: 143 },
                    { key: '08', doc_count: 140 },
                    { key: '23', doc_count: 138 },
                    { key: '32', doc_count: 135 },
                    { key: '45', doc_count: 132 },
                    { key: '67', doc_count: 128 }
                ]
            },
            noi_dung_agg: {
                buckets: [
                    { key: 'Khác', doc_count: 5748 },
                    { key: 'Hạ tầng, luồng tuyến', doc_count: 587 },
                    { key: 'NVPV', doc_count: 573 },
                    { key: 'Chất lượng phục vụ', doc_count: 520 },
                    { key: 'Thiết bị xe', doc_count: 485 },
                    { key: 'Vé, cước', doc_count: 450 },
                    { key: 'Lịch trình', doc_count: 420 },
                    { key: 'An toàn giao thông', doc_count: 380 },
                    { key: 'Vệ sinh xe', doc_count: 350 },
                    { key: 'Điều độ', doc_count: 320 },
                    { key: 'Tài xế', doc_count: 290 },
                    { key: 'Phụ xe', doc_count: 275 },
                    { key: 'Trạm dừng', doc_count: 260 },
                    { key: 'Thông tin hành trình', doc_count: 240 },
                    { key: 'Kỹ thuật xe', doc_count: 102 }
                ]
            }
        }
    };
}

// Basic chart updates (legacy function - replaced by updateAllChartsEnhanced)
function updateBasicCharts(data) {
    const aggs = data.aggregations;

    updateSourceChart(aggs.nguon_agg.buckets);
    updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
    updateTypeChart(aggs.loai_agg.buckets);
    updateSeverityChart(aggs.cap_do_agg.buckets);
    updateTargetChart(aggs.doi_tuong_agg.buckets);
    updateStatusChart(aggs.trang_thai_agg.buckets);
    updateRouteChart(aggs.tuyen_agg.buckets);
    updateContentChart(aggs.noi_dung_agg.buckets);
}

// Update source distribution pie chart
function updateSourceChart(data) {
    if (!data || !Array.isArray(data)) {
        console.warn('Invalid data for source chart');
        return;
    }

    if (!charts.sourceChart) {
        console.warn('Source chart not initialized');
        return;
    }

    const total = data.reduce((sum, item) => sum + item.doc_count, 0);

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(100, 200, 255, 0.3)',
            borderWidth: 1,
            borderRadius: 12,
            textStyle: {
                color: '#ffffff',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif'
            },
            extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;',
            formatter: function(params) {
                const percentage = params.percent;
                const value = params.value;
                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            📊 ${params.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${params.name}</strong><br/>
                            Số lượng: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        legend: {
            orient: 'vertical',
            left: 'left',
            textStyle: {
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif'
            },
            itemWidth: 12,
            itemHeight: 12,
            icon: 'circle'
        },
        series: [
            {
                name: 'Nguồn báo cáo',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['60%', '50%'],
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowColor: 'transparent',
                        scale: true,
                        scaleSize: 10
                    },
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#ffffff',
                        textShadowBlur: 0,
                        textShadowColor: 'transparent',
                        textShadowOffsetX: 0,
                        textShadowOffsetY: 0
                    }
                },
                itemStyle: {
                    borderRadius: 8,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                animationType: 'scale',
                animationEasing: 'elasticOut',
                animationDelay: function (idx) {
                    return idx * 100;
                }
            }
        ],
        color: ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444']
    };

    hideLoadingState('sourceChart');
    charts.sourceChart.setOption(option);
}

// Update enterprise bar chart
function updateEnterpriseChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            borderColor: 'rgba(100, 200, 255, 0.3)',
            borderWidth: 1,
            borderRadius: 12,
            textStyle: {
                color: '#ffffff',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif'
            },
            extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;',
            axisPointer: {
                type: 'shadow',
                shadowStyle: {
                    color: 'rgba(100, 200, 255, 0.1)'
                }
            },
            formatter: function(params) {
                const param = params[0];
                const value = param.value;
                const name = param.axisValue;
                const total = data.reduce((sum, item) => sum + item.doc_count, 0);
                const percentage = ((value / total) * 100).toFixed(1);

                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            🏢 ${param.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${name}</strong><br/>
                            Số báo cáo: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        xAxis: {
            type: 'category',
            data: data.slice(0, 10).map(item => item.key),
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            },
            axisTick: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                fontFamily: 'Inter, sans-serif',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(100, 200, 255, 0.1)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 10).map(item => item.doc_count),
                type: 'bar',
                barWidth: '60%',
                itemStyle: {
                    borderRadius: [4, 4, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#64c8ff' },
                        { offset: 0.5, color: '#00ffc8' },
                        { offset: 1, color: '#00b899' }
                    ]),
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                emphasis: {
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: '#64c8ff' },
                            { offset: 0.7, color: '#00ffc8' },
                            { offset: 1, color: '#00e6cc' }
                        ]),
                        shadowBlur: 0,
                        shadowColor: 'transparent'
                    }
                },
                animationDelay: function (idx) {
                    return idx * 100;
                },
                animationEasing: 'elasticOut'
            }
        ]
    };

    hideLoadingState('enterpriseChart');
    charts.enterpriseChart.setOption(option);
}

// Enhanced tooltip configuration for all charts
const enhancedTooltipConfig = {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    borderColor: 'rgba(100, 200, 255, 0.3)',
    borderWidth: 1,
    borderRadius: 12,
    textStyle: {
        color: '#ffffff',
        fontSize: 13,
        fontFamily: 'Inter, sans-serif'
    },
    extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7); padding: 15px;'
};

// Enhanced animation configuration
const enhancedAnimationConfig = {
    animationDuration: 1000,
    animationEasing: 'elasticOut',
    animationDelay: function (idx) {
        return idx * 100;
    }
};

// Update type chart
function updateTypeChart(data) {
    const total = data.reduce((sum, item) => sum + item.doc_count, 0);

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            ...enhancedTooltipConfig,
            formatter: function(params) {
                const percentage = params.percent;
                const value = params.value;
                return `
                    <div style="padding: 5px;">
                        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 8px; font-size: 14px;">
                            📋 ${params.seriesName}
                        </div>
                        <div style="color: #ffffff; line-height: 1.5;">
                            <strong style="color: #00ffc8;">${params.name}</strong><br/>
                            Số lượng: <span style="color: #00ffc8; font-weight: 600;">${value.toLocaleString()}</span><br/>
                            Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${percentage}%</span><br/>
                            Tổng: <span style="color: #64c8ff;">${total.toLocaleString()}</span>
                        </div>
                    </div>
                `;
            }
        },
        legend: {
            orient: 'vertical',
            right: 10,
            top: 20,
            textStyle: {
                color: '#ffffff',
                fontSize: 12,
                fontFamily: 'Inter, sans-serif'
            },
            itemWidth: 12,
            itemHeight: 12,
            icon: 'circle'
        },
        series: [
            {
                name: 'Loại báo cáo',
                type: 'pie',
                radius: ['40%', '70%'],
                center: ['45%', '50%'],
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowColor: 'transparent',
                        scale: true,
                        scaleSize: 10
                    },
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        color: '#ffffff',
                        textShadowBlur: 0,
                        textShadowColor: 'transparent',
                        textShadowOffsetX: 0,
                        textShadowOffsetY: 0
                    }
                },
                itemStyle: {
                    borderRadius: 8,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 2,
                    shadowColor: 'transparent',
                    shadowBlur: 0
                },
                ...enhancedAnimationConfig
            }
        ],
        color: ['#ff9664', '#64c8ff', '#00ffc8', '#a855f7', '#f59e0b', '#ef4444']
    };

    hideLoadingState('typeChart');
    charts.typeChart.setOption(option);
}

// Update severity chart
function updateSeverityChart(data) {
    const severityNames = { 1: 'Thấp', 2: 'Trung bình', 3: 'Cao' };

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Cấp độ',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: severityNames[item.key] || item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#00ffbb', '#00d4aa', '#ff4757']
    };

    hideLoadingState('severityChart');
    charts.severityChart.setOption(option);
}

// Update target chart
function updateTargetChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Đối tượng',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#1890ff', '#52c41a', '#faad14']
    };

    hideLoadingState('targetChart');
    charts.targetChart.setOption(option);
}

// Update status chart
function updateStatusChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [
            {
                name: 'Trạng thái',
                type: 'pie',
                radius: '50%',
                data: data.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                emphasis: {
                    itemStyle: {
                        shadowBlur: 0,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.5)'
                    }
                }
            }
        ],
        color: ['#52c41a', '#faad14']
    };

    hideLoadingState('statusChart');
    charts.statusChart.setOption(option);
}

// Update route chart
function updateRouteChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        xAxis: {
            type: 'category',
            data: data.slice(0, 15).map(item => item.key),
            axisLabel: {
                rotate: 0,
                fontSize: 12,
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 15).map(item => item.doc_count),
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#00ffbb' },
                        { offset: 0.5, color: '#00e6cc' },
                        { offset: 1, color: '#00d4aa' }
                    ])
                }
            }
        ]
    };

    hideLoadingState('routeChart');
    charts.routeChart.setOption(option);
}

// Update content chart
function updateContentChart(data) {
    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                fontSize: 16,
                fontWeight: 'bold',
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        xAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: data.slice(0, 10).map(item => item.key).reverse(),
            axisLabel: {
                fontSize: 11,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        series: [
            {
                name: 'Số báo cáo',
                data: data.slice(0, 10).map(item => item.doc_count).reverse(),
                type: 'bar',
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#ee6666' },
                        { offset: 0.5, color: '#5470c6' },
                        { offset: 1, color: '#91cc75' }
                    ])
                }
            }
        ]
    };

    hideLoadingState('contentChart');
    charts.contentChart.setOption(option);
}

// Update statistics with professional animations
function updateStatsWithAnimation(data) {
    // Handle both data.aggregations and direct aggregations
    let aggs;
    if (data && data.aggregations) {
        aggs = data.aggregations;
    } else if (data && typeof data === 'object' && (data.nguon_agg || data.xi_nghiep_agg)) {
        // Direct aggregations object
        aggs = data;
    } else {
        console.warn('Invalid data for updateStatsWithAnimation');
        return;
    }

    // Update total records with animation
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl && aggs.total_records && aggs.total_records.value) {
        animateStatsCounter(totalRecordsEl, aggs.total_records.value, 1200);
    } else if (totalRecordsEl && aggs.nguon_agg && aggs.nguon_agg.buckets) {
        // Calculate total records from source aggregation as fallback
        const totalRecords = aggs.nguon_agg.buckets.reduce((sum, bucket) => sum + bucket.doc_count, 0);
        animateStatsCounter(totalRecordsEl, totalRecords, 1200);
    } else {
        console.warn('Total records data or element not found');
        if (totalRecordsEl) totalRecordsEl.textContent = 'N/A';
    }

    // Update total enterprises with animation
    const totalEnterprisesEl = document.getElementById('totalEnterprises');
    if (totalEnterprisesEl && aggs.xi_nghiep_agg && aggs.xi_nghiep_agg.buckets) {
        animateStatsCounter(totalEnterprisesEl, aggs.xi_nghiep_agg.buckets.length, 800);
    } else {
        console.warn('Enterprise data or element not found');
        if (totalEnterprisesEl) totalEnterprisesEl.textContent = 'N/A';
    }

    // Update total routes with animation
    const totalRoutesEl = document.getElementById('totalRoutes');
    if (totalRoutesEl && aggs.tuyen_agg && aggs.tuyen_agg.buckets) {
        animateStatsCounter(totalRoutesEl, aggs.tuyen_agg.buckets.length, 600);
    } else {
        console.warn('Route data or element not found');
        if (totalRoutesEl) totalRoutesEl.textContent = 'N/A';
    }
}

// Update statistics (legacy function for backward compatibility)
function updateStats(data) {
    // Handle both data.aggregations and direct aggregations
    let aggs;
    if (data && data.aggregations) {
        aggs = data.aggregations;
    } else if (data && typeof data === 'object' && (data.nguon_agg || data.xi_nghiep_agg)) {
        // Direct aggregations object
        aggs = data;
    } else {
        console.warn('Invalid data for updateStats');
        return;
    }

    // Update total records with null checks
    const totalRecordsEl = document.getElementById('totalRecords');
    if (totalRecordsEl && aggs.total_records && aggs.total_records.value) {
        totalRecordsEl.textContent = aggs.total_records.value.toLocaleString('vi-VN');
    } else {
        console.warn('Total records data or element not found');
        if (totalRecordsEl) totalRecordsEl.textContent = 'N/A';
    }

    // Update total enterprises
    const totalEnterprisesEl = document.getElementById('totalEnterprises');
    if (totalEnterprisesEl && aggs.xi_nghiep_agg && aggs.xi_nghiep_agg.buckets) {
        totalEnterprisesEl.textContent = aggs.xi_nghiep_agg.buckets.length;
    } else {
        console.warn('Enterprise data or element not found');
        if (totalEnterprisesEl) totalEnterprisesEl.textContent = 'N/A';
    }

    // Update total routes
    const totalRoutesEl = document.getElementById('totalRoutes');
    if (totalRoutesEl && aggs.tuyen_agg && aggs.tuyen_agg.buckets) {
        totalRoutesEl.textContent = aggs.tuyen_agg.buckets.length;
    } else {
        console.warn('Route data or element not found');
        if (totalRoutesEl) totalRoutesEl.textContent = 'N/A';
    }

    // Update total records (alternative calculation from source aggregation)
    if (totalRecordsEl && aggs.nguon_agg && aggs.nguon_agg.buckets) {
        // Calculate total records from source aggregation as fallback
        const totalRecords = aggs.nguon_agg.buckets.reduce((sum, bucket) => sum + bucket.doc_count, 0);
        if (!aggs.total_records || !aggs.total_records.value) {
            totalRecordsEl.textContent = totalRecords.toLocaleString();
        }
    }
}

// Update last update time
function updateLastUpdateTime() {
    const lastUpdateEl = document.getElementById('lastUpdate');
    if (!lastUpdateEl) {
        console.warn('Last update element not found');
        return;
    }

    try {
        const now = new Date();
        const timeString = now.toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        lastUpdateEl.textContent = `Cập nhật lần cuối: ${timeString}`;
    } catch (error) {
        console.error('Error updating last update time:', error);
        lastUpdateEl.textContent = 'Cập nhật lần cuối: N/A';
    }
}

// Show error message
function showError(message) {
    try {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message || 'Đã xảy ra lỗi không xác định';

        const container = document.querySelector('.container');
        if (container) {
            container.insertBefore(errorDiv, container.firstChild);

            // Remove error after 5 seconds
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        } else {
            // Fallback: use alert if container not found
            alert(message || 'Đã xảy ra lỗi không xác định');
        }

        // Hide loading for all charts safely
        Object.values(charts).forEach(chart => {
            if (chart && typeof chart.hideLoading === 'function') {
                try {
                    chart.hideLoading();
                } catch (error) {
                    console.warn('Error hiding loading for chart:', error);
                }
            }
        });
    } catch (error) {
        console.error('Error in showError function:', error);
        // Ultimate fallback
        alert(message || 'Đã xảy ra lỗi không xác định');
    }
}

// Initialize tab navigation with debouncing for performance
let tabSwitchDebounce = null;
let currentActiveTab = 'overview';

// DUPLICATE FUNCTION - DISABLED TO PREVENT CONFLICTS
function initializeTabs_DISABLED() {
    // This function is disabled - using initializeTabNavigation instead
    return;
    const menuLinks = document.querySelectorAll('.menu-link');
    console.log(`🔧 Found ${menuLinks.length} menu links`);

    menuLinks.forEach(menuLink => {
        menuLink.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = menuLink.getAttribute('data-tab');
            if (!targetTab) {
                console.error('❌ No data-tab attribute found');
                return;
            }

            console.log(`🔄 Switching to tab: ${targetTab}`);

            // Simple nav animation
            menuLink.style.transform = 'scale(0.98)';
            setTimeout(() => {
                menuLink.style.transform = 'scale(1)';
            }, PERFORMANCE_CONFIG.DEBOUNCE_DELAY);

            // Remove active class from all menu links
            menuLinks.forEach(link => link.classList.remove('active'));

            // Add active class to clicked menu link
            menuLink.classList.add('active');
            currentActiveTab = targetTab;

            // Show loading for target tab first
            showTabLoading(targetTab);

            // Direct tab switching without complex animations
            try {
                // Hide all tabs
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });

                // Show target tab
                const targetTabElement = document.getElementById(targetTab + '-tab');
                if (targetTabElement) {
                    targetTabElement.classList.add('active');
                    console.log(`✅ Tab switched to: ${targetTab}`);

                    // Debug: Check charts in this tab
                    const tabCharts = CHARTS_BY_TAB[targetTab] || [];
                    console.log(`📊 Tab ${targetTab} should have ${tabCharts.length} charts:`, tabCharts);

                    // Initialize charts for this tab if lazy loading is enabled
                    if (PERFORMANCE_CONFIG.LAZY_LOAD_ENABLED && !initializedTabs.has(targetTab)) {
                        initializeTabCharts(targetTab);
                    }

                    // Update charts for new tab after a short delay
                    setTimeout(() => {
                        if (lastFetchedData) {
                            // Only update visible charts
                            const visibleCharts = CHARTS_BY_TAB[targetTab] || [];
                            visibleCharts.forEach(chartId => {
                                if (charts[chartId]) {
                                    updateChartByType(chartId, lastFetchedData);
                                }
                            });

                            // Hide loading after charts are updated
                            setTimeout(() => {
                                hideTabLoading(targetTab);
                            }, 200);
                        }
                    }, 100);
                } else {
                    console.error(`❌ Tab element not found: ${targetTab}-tab`);
                }
            } catch (error) {
                console.error('❌ Tab switching error:', error);
            }
        });
    });
}

// Initialize export buttons
function initializeExportButtons() {
    const exportButtons = document.querySelectorAll('.btn-export');
    exportButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const exportType = button.getAttribute('data-export');
            exportSpecificReport(exportType);
        });
    });
}

// Enhanced mock data generator with deeper analytics
function generateEnhancedMockData() {
    const baseData = generateMockData();

    // Add enhanced aggregations
    baseData.aggregations.enterprise_type_matrix = {
        buckets: [
            {
                key: 'Buýt Cầu Bươu',
                doc_count: 1155,
                by_type: {
                    buckets: [
                        { key: 'Khác', doc_count: 400 },
                        { key: 'Góp ý', doc_count: 300 },
                        { key: 'Phản ánh', doc_count: 250 },
                        { key: 'Khen ngợi', doc_count: 205 }
                    ]
                }
            },
            {
                key: 'Xí nghiệp Xe Khách Nam',
                doc_count: 1153,
                by_type: {
                    buckets: [
                        { key: 'Khác', doc_count: 380 },
                        { key: 'Góp ý', doc_count: 320 },
                        { key: 'Phản ánh', doc_count: 270 },
                        { key: 'Khen ngợi', doc_count: 183 }
                    ]
                }
            }
        ]
    };

    baseData.aggregations.severity_type_matrix = {
        buckets: [
            {
                key: 1,
                doc_count: 3400,
                by_type: {
                    buckets: [
                        { key: 'Khen ngợi', doc_count: 1200 },
                        { key: 'Góp ý', doc_count: 1000 },
                        { key: 'Khác', doc_count: 1200 }
                    ]
                }
            },
            {
                key: 2,
                doc_count: 4200,
                by_type: {
                    buckets: [
                        { key: 'Phản ánh', doc_count: 1500 },
                        { key: 'Góp ý', doc_count: 1400 },
                        { key: 'Khác', doc_count: 1300 }
                    ]
                }
            },
            {
                key: 3,
                doc_count: 2400,
                by_type: {
                    buckets: [
                        { key: 'Khiếu nại', doc_count: 1200 },
                        { key: 'Báo cáo sự cố', doc_count: 800 },
                        { key: 'Phản ánh', doc_count: 400 }
                    ]
                }
            }
        ]
    };

    baseData.aggregations.target_analysis = {
        buckets: [
            {
                key: 'CNLX',
                doc_count: 3390,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1200 },
                        { key: 'zalo', doc_count: 1100 },
                        { key: 'call', doc_count: 1090 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1500 },
                        { key: 1, doc_count: 1000 },
                        { key: 3, doc_count: 890 }
                    ]
                }
            },
            {
                key: 'GARA',
                doc_count: 3337,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1150 },
                        { key: 'zalo', doc_count: 1100 },
                        { key: 'call', doc_count: 1087 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1400 },
                        { key: 1, doc_count: 1200 },
                        { key: 3, doc_count: 737 }
                    ]
                }
            },
            {
                key: 'NVPV',
                doc_count: 3273,
                by_source: {
                    buckets: [
                        { key: 'facebook', doc_count: 1090 },
                        { key: 'zalo', doc_count: 1112 },
                        { key: 'call', doc_count: 1071 }
                    ]
                },
                by_severity: {
                    buckets: [
                        { key: 2, doc_count: 1300 },
                        { key: 1, doc_count: 1200 },
                        { key: 3, doc_count: 773 }
                    ]
                }
            }
        ]
    };

    baseData.aggregations.time_analysis = {
        buckets: generateTimeSeriesData()
    };

    baseData.aggregations.praise_analysis = {
        doc_count: 1671,
        by_source: {
            buckets: [
                { key: 'facebook', doc_count: 600 },
                { key: 'zalo', doc_count: 550 },
                { key: 'call', doc_count: 521 }
            ]
        },
        by_enterprise: {
            buckets: [
                { key: 'Buýt Cầu Bươu', doc_count: 205 },
                { key: 'Xí nghiệp Xe Khách Nam', doc_count: 183 },
                { key: 'Buýt nhanh BRT', doc_count: 175 },
                { key: 'Buýt 10-10', doc_count: 168 },
                { key: 'Công ty Cổ phần Xe Điện', doc_count: 145 }
            ]
        }
    };

    return baseData;
}

// Generate time series data for trend analysis
function generateTimeSeriesData() {
    const data = [];
    const startTime = new Date('1970-01-01T00:29:03');

    for (let i = 0; i < 9; i++) {
        const time = new Date(startTime.getTime() + i * 1000);
        data.push({
            key_as_string: time.toISOString(),
            key: time.getTime(),
            doc_count: Math.floor(Math.random() * 2000) + 500
        });
    }

    return data;
}

// Update all charts including new detailed analysis charts
// Update individual chart by type with proper error handling
function updateChartByType(chartId, data) {
    if (!data || !data.aggregations) {
        console.error(`Invalid data passed to updateChartByType for ${chartId}`);
        return;
    }

    if (!charts[chartId] || charts[chartId].isDisposed()) {
        console.warn(`Chart ${chartId} is not initialized or disposed`);
        return;
    }

    const aggs = data.aggregations;

    try {
        // Update chart based on its type/id
        switch (chartId) {
            // Overview charts
            case 'sourceChart':
                updateSourceChart(aggs.nguon_agg.buckets);
                break;
            case 'enterpriseChart':
                updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
                break;
            case 'typeChart':
                updateTypeChart(aggs.loai_agg.buckets);
                break;
            case 'severityChart':
                updateSeverityChart(aggs.cap_do_agg.buckets);
                break;
            case 'targetChart':
                updateTargetChart(aggs.doi_tuong_agg.buckets);
                break;
            case 'statusChart':
                updateStatusChart(aggs.trang_thai_agg.buckets);
                break;
            case 'routeChart':
                updateRouteChart(aggs.tuyen_agg.buckets);
                break;
            case 'contentChart':
                updateContentChart(aggs.noi_dung_agg.buckets);
                break;

            // Detailed charts
            case 'enterpriseTypeMatrix':
                updateEnterpriseTypeMatrix(aggs);
                break;
            case 'timeTrendChart':
                updateTimeTrendChart(aggs);
                break;
            case 'severityTypeChart':
                updateSeverityTypeChart(aggs);
                break;
            case 'riskAnalysisChart':
                updateRiskAnalysisChart(aggs);
                break;
            case 'routeMonthlyChart':
                updateRouteMonthlyChart(aggs);
                break;

            // Analytics charts
            case 'cnlxAnalytics':
            case 'garaAnalytics':
            case 'nvpvAnalytics':
                updateTargetAnalysisCharts(aggs);
                break;
            case 'praiseBySourceChart':
            case 'praiseByEnterpriseChart':
                updatePraiseAnalysisCharts(aggs);
                break;
            case 'responseRateChart':
            case 'responseTimeChart':
                updateResponseAnalysisCharts(aggs);
                break;

            // Export charts
            case 'networkAnalysisChart':
                updateNetworkAnalysisChart(aggs);
                break;
            case 'heatmapChart':
                updateHeatmapChart(aggs);
                break;
            case 'correlationChart':
                updateCorrelationChart(aggs);
                break;

            default:
                console.warn(`Unknown chart type: ${chartId}`);
        }
    } catch (error) {
        console.error(`Error updating chart ${chartId}:`, error);
    }
}

function updateAllChartsEnhanced(data) {
    if (!data || !data.aggregations) {
        console.error('Invalid data passed to updateAllChartsEnhanced');
        return;
    }

    const aggs = data.aggregations;
    console.log('Updating charts with enhanced data...');

    // Get currently active tab to prioritize updates
    const activeTab = document.querySelector('.tab-content.active');
    const activeTabId = activeTab ? activeTab.id : 'overview-tab';

    // Always update overview charts (they're most commonly viewed)
    if (activeTabId === 'overview-tab' || !activeTab) {
        console.log('Updating overview charts');
        updateSourceChart(aggs.nguon_agg.buckets);
        updateEnterpriseChart(aggs.xi_nghiep_agg.buckets);
        updateTypeChart(aggs.loai_agg.buckets);
        updateSeverityChart(aggs.cap_do_agg.buckets);
        updateTargetChart(aggs.doi_tuong_agg.buckets);
        updateStatusChart(aggs.trang_thai_agg.buckets);
        updateRouteChart(aggs.tuyen_agg.buckets);
        updateContentChart(aggs.noi_dung_agg.buckets);
    }

    // Update charts based on active tab for better performance
    // Use requestAnimationFrame for smooth chart updates
    requestAnimationFrame(() => {
        if (activeTabId === 'detailed-tab' || !activeTab) {
            console.log('🔄 Updating detailed charts');
            const detailedUpdates = [];

            if (aggs.enterprise_type_matrix) {
                detailedUpdates.push(() => updateEnterpriseTypeMatrix(aggs.enterprise_type_matrix.buckets));
            }

            if (aggs.time_analysis) {
                detailedUpdates.push(() => updateTimeTrendChart(aggs.time_analysis.buckets));
            }

            if (aggs.severity_type_matrix) {
                detailedUpdates.push(() => updateSeverityTypeChart(aggs.severity_type_matrix.buckets));
                detailedUpdates.push(() => updateRiskAnalysisChart(aggs.severity_type_matrix.buckets));
            }

            if (aggs.tuyen_agg) {
                detailedUpdates.push(() => updateRouteMonthlyChart(aggs.tuyen_agg.buckets));
            }

            // Batch update with small delays for smooth performance
            detailedUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }

        if (activeTabId === 'analytics-tab' || !activeTab) {
            console.log('📈 Updating analytics charts');
            const analyticsUpdates = [];

            if (aggs.target_analysis) {
                analyticsUpdates.push(() => updateTargetAnalysisCharts(aggs.target_analysis.buckets));
            }

            if (aggs.praise_analysis) {
                analyticsUpdates.push(() => updatePraiseAnalysisCharts(aggs.praise_analysis));
            }

            analyticsUpdates.push(() => updateResponseAnalysisCharts(aggs));

            // Batch update with small delays
            analyticsUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }

        if (activeTabId === 'exports-tab' || !activeTab) {
            console.log('📤 Updating exports charts');
            const exportsUpdates = [
                () => updateNetworkAnalysisChart(aggs),
                () => updateHeatmapChart(aggs),
                () => updateCorrelationChart(aggs)
            ];

            // Batch update with small delays
            exportsUpdates.forEach((updateFn, index) => {
                setTimeout(updateFn, index * 50);
            });
        }
    });

    console.log(`Charts update completed for tab: ${activeTabId}`);
}

// Force update all charts with animations (for refresh button)
function forceUpdateAllCharts(data) {
    if (!data || !data.aggregations) {
        console.error('Invalid data passed to forceUpdateAllCharts');
        return;
    }

    const aggs = data.aggregations;
    console.log('Force updating all charts with animations...');

    // Define chart updates with animation timing
    const chartUpdates = [
        { id: 'sourceChart', updateFn: () => updateSourceChart(aggs.nguon_agg.buckets) },
        { id: 'enterpriseChart', updateFn: () => updateEnterpriseChart(aggs.xi_nghiep_agg.buckets) },
        { id: 'typeChart', updateFn: () => updateTypeChart(aggs.loai_agg.buckets) },
        { id: 'severityChart', updateFn: () => updateSeverityChart(aggs.cap_do_agg.buckets) },
        { id: 'targetChart', updateFn: () => updateTargetChart(aggs.doi_tuong_agg.buckets) },
        { id: 'statusChart', updateFn: () => updateStatusChart(aggs.trang_thai_agg.buckets) },
        { id: 'routeChart', updateFn: () => updateRouteChart(aggs.tuyen_agg.buckets) },
        { id: 'contentChart', updateFn: () => updateContentChart(aggs.noi_dung_agg.buckets) }
    ];

    // Update charts with staggered animations
    chartUpdates.forEach((chart, index) => {
        setTimeout(() => {
            chart.updateFn();
            // Add animation after chart update
            setTimeout(() => {
                animateChartUpdate(chart.id);
            }, 100);
        }, index * 150); // Stagger updates for smooth experience
    });

    // Detailed charts with animations
    const detailedChartUpdates = [];
    if (aggs.enterprise_type_matrix) {
        detailedChartUpdates.push({ id: 'enterpriseTypeMatrix', updateFn: () => updateEnterpriseTypeMatrix(aggs.enterprise_type_matrix.buckets) });
    }
    if (aggs.time_analysis) {
        detailedChartUpdates.push({ id: 'timeTrendChart', updateFn: () => updateTimeTrendChart(aggs.time_analysis.buckets) });
    }
    if (aggs.severity_type_matrix) {
        detailedChartUpdates.push({ id: 'severityTypeChart', updateFn: () => updateSeverityTypeChart(aggs.severity_type_matrix.buckets) });
        detailedChartUpdates.push({ id: 'riskAnalysisChart', updateFn: () => updateRiskAnalysisChart(aggs.severity_type_matrix.buckets) });
    }
    if (aggs.tuyen_agg) {
        detailedChartUpdates.push({ id: 'routeMonthlyChart', updateFn: () => updateRouteMonthlyChart(aggs.tuyen_agg.buckets) });
    }

    // Update detailed charts with animations
    detailedChartUpdates.forEach((chart, index) => {
        setTimeout(() => {
            chart.updateFn();
            setTimeout(() => {
                animateChartUpdate(chart.id);
            }, 100);
        }, (chartUpdates.length + index) * 150); // Continue after overview charts
    });

    // Analytics charts with animations
    const analyticsChartUpdates = [];
    if (aggs.target_analysis) {
        analyticsChartUpdates.push({ id: 'cnlxAnalytics', updateFn: () => updateTargetAnalysisCharts(aggs.target_analysis.buckets) });
    }
    if (aggs.praise_analysis) {
        analyticsChartUpdates.push({ id: 'praiseBySourceChart', updateFn: () => updatePraiseAnalysisCharts(aggs.praise_analysis) });
    }
    analyticsChartUpdates.push({ id: 'responseRateChart', updateFn: () => updateResponseAnalysisCharts(aggs) });

    // Update analytics charts with animations
    analyticsChartUpdates.forEach((chart, index) => {
        setTimeout(() => {
            chart.updateFn();
            setTimeout(() => {
                animateChartUpdate(chart.id);
            }, 100);
        }, (chartUpdates.length + detailedChartUpdates.length + index) * 150);
    });

    // Exports charts with animations
    const exportsChartUpdates = [
        { id: 'networkAnalysisChart', updateFn: () => updateNetworkAnalysisChart(aggs) },
        { id: 'heatmapChart', updateFn: () => updateHeatmapChart(aggs) },
        { id: 'correlationChart', updateFn: () => updateCorrelationChart(aggs) }
    ];

    // Update exports charts with animations
    exportsChartUpdates.forEach((chart, index) => {
        setTimeout(() => {
            chart.updateFn();
            setTimeout(() => {
                animateChartUpdate(chart.id);
            }, 100);
        }, (chartUpdates.length + detailedChartUpdates.length + analyticsChartUpdates.length + index) * 150);
    });

    console.log('🎬 Force update all charts completed with professional animations');
}

// Enterprise Type Matrix Chart
function updateEnterpriseTypeMatrix(data) {
    if (!charts.enterpriseTypeMatrix) return;

    const categories = [...new Set(data.flatMap(item =>
        item.by_type.buckets.map(bucket => bucket.key)
    ))];

    const series = categories.map(category => ({
        name: category,
        type: 'bar',
        stack: 'total',
        data: data.map(enterprise => {
            const bucket = enterprise.by_type.buckets.find(b => b.key === category);
            return bucket ? bucket.doc_count : 0;
        })
    }));

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        legend: {
            data: categories,
            bottom: 0,
            textStyle: {
                color: '#ffffff'
            }
        },
        xAxis: {
            type: 'category',
            data: data.map(item => item.key),
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: series,
        color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272']
    };

    charts.enterpriseTypeMatrix.hideLoading();
    charts.enterpriseTypeMatrix.setOption(option);
}

// Time Trend Chart
function updateTimeTrendChart(data) {
    if (!charts.timeTrendChart) return;

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis'
        },
        xAxis: {
            type: 'time',
            data: data.map(item => item.key),
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [{
            name: 'Số báo cáo',
            type: 'line',
            data: data.map(item => [item.key, item.doc_count]),
            smooth: true,
            lineStyle: {
                width: 3
            },
            areaStyle: {
                opacity: 0.3
            },
            itemStyle: {
                color: '#00ffbb'
            }
        }],
        color: ['#00ffbb']
    };

    charts.timeTrendChart.hideLoading();
    charts.timeTrendChart.setOption(option);
}

// Severity Type Matrix Chart
function updateSeverityTypeChart(data) {
    if (!charts.severityTypeChart) return;

    const severityNames = { 1: 'Thấp', 2: 'Trung bình', 3: 'Cao' };
    const categories = [...new Set(data.flatMap(item =>
        item.by_type.buckets.map(bucket => bucket.key)
    ))];

    const chartData = [];
    data.forEach((severityItem, i) => {
        severityItem.by_type.buckets.forEach((typeItem, j) => {
            chartData.push([i, j, typeItem.doc_count]);
        });
    });

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                const severity = severityNames[data[params.data[0]].key];
                const type = categories[params.data[1]];
                return `${severity} - ${type}<br/>Số lượng: ${params.data[2]}`;
            }
        },
        grid: {
            height: '50%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: data.map(item => severityNames[item.key]),
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: categories,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...chartData.map(item => item[2])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%',
            color: ['#00ffbb', '#52c4e1', '#4ecdc4']
        },
        series: [{
            name: 'Số báo cáo',
            type: 'heatmap',
            data: chartData,
            label: {
                show: true
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    charts.severityTypeChart.hideLoading();
    charts.severityTypeChart.setOption(option);
}

// Risk Analysis Chart
function updateRiskAnalysisChart(data) {
    if (!charts.riskAnalysisChart) return;

    const riskData = data.map(item => {
        const highRiskTypes = item.by_type.buckets.filter(type =>
            ['Khiếu nại', 'Báo cáo sự cố', 'Phản ánh'].includes(type.key)
        );
        const riskScore = highRiskTypes.reduce((sum, type) => sum + type.doc_count, 0);
        return {
            name: `Cấp ${item.key}`,
            value: riskScore,
            itemStyle: {
                color: item.key === 3 ? '#ff6b6b' : item.key === 2 ? '#f8a14e' : '#52c4e1'
            }
        };
    });

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'item',
            formatter: '{a} <br/>{b}: {c} ({d}%)'
        },
        series: [{
            name: 'Mức rủi ro',
            type: 'pie',
            radius: ['40%', '70%'],
            data: riskData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    charts.riskAnalysisChart.hideLoading();
    charts.riskAnalysisChart.setOption(option);
}

// Route Monthly Chart
function updateRouteMonthlyChart(data) {
    if (!charts.routeMonthlyChart) return;

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: {
                type: 'shadow'
            }
        },
        dataZoom: [
            {
                type: 'slider',
                show: true,
                xAxisIndex: [0],
                start: 0,
                end: 50
            }
        ],
        xAxis: {
            type: 'category',
            data: data.map(item => item.key),
            axisLabel: {
                rotate: 45,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'value',
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            },
            splitLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.1)'
                }
            }
        },
        series: [{
            name: 'Số báo cáo',
            type: 'bar',
            data: data.map(item => item.doc_count),
            itemStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                    { offset: 0, color: '#83bff6' },
                    { offset: 0.5, color: '#188df0' },
                    { offset: 1, color: '#188df0' }
                ])
            }
        }]
    };

    charts.routeMonthlyChart.hideLoading();
    charts.routeMonthlyChart.setOption(option);
}

// Target Analysis Charts
function updateTargetAnalysisCharts(data) {
    // CNLX Analytics
    if (charts.cnlxAnalytics) {
        const cnlxData = data.find(item => item.key === 'CNLX');
        if (cnlxData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'item'
                },
                series: [{
                    name: 'Nguồn báo cáo',
                    type: 'pie',
                    radius: '50%',
                    data: cnlxData.by_source.buckets.map(item => ({
                        value: item.doc_count,
                        name: item.key
                    }))
                }],
                color: ['#00ffbb', '#52c4e1', '#f8a14e'],
                legend: {
                    textStyle: {
                        color: '#ffffff'
                    }
                }
            };
            charts.cnlxAnalytics.hideLoading();
            charts.cnlxAnalytics.setOption(option);
        }
    }

    // GARA Analytics
    if (charts.garaAnalytics) {
        const garaData = data.find(item => item.key === 'GARA');
        if (garaData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'item'
                },
                series: [{
                    name: 'Cấp độ',
                    type: 'pie',
                    radius: ['30%', '60%'],
                    data: garaData.by_severity.buckets.map(item => ({
                        value: item.doc_count,
                        name: `Cấp ${item.key}`
                    }))
                }],
                color: ['#52c4e1', '#f8a14e', '#ff6b6b'],
                legend: {
                    textStyle: {
                        color: '#ffffff'
                    }
                }
            };
            charts.garaAnalytics.hideLoading();
            charts.garaAnalytics.setOption(option);
        }
    }

    // NVPV Analytics
    if (charts.nvpvAnalytics) {
        const nvpvData = data.find(item => item.key === 'NVPV');
        if (nvpvData) {
            const option = {
                title: {
                    text: '',
                    left: 'center',
                    textStyle: {
                        color: '#ffffff'
                    }
                },
                tooltip: {
                    trigger: 'axis'
                },
                xAxis: {
                    type: 'category',
                    data: nvpvData.by_source.buckets.map(item => item.key),
                    axisLabel: {
                        color: '#ffffff'
                    },
                    axisLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.3)'
                        }
                    }
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        color: '#ffffff'
                    },
                    axisLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.3)'
                        }
                    },
                    splitLine: {
                        lineStyle: {
                            color: 'rgba(0, 255, 187, 0.1)'
                        }
                    }
                },
                series: [{
                    name: 'Số báo cáo',
                    type: 'bar',
                    data: nvpvData.by_source.buckets.map(item => item.doc_count),
                    itemStyle: {
                        color: '#00ffbb'
                    }
                }]
            };
            charts.nvpvAnalytics.hideLoading();
            charts.nvpvAnalytics.setOption(option);
        }
    }
}

// Praise Analysis Charts
function updatePraiseAnalysisCharts(data) {
    // Praise by Source
    if (charts.praiseBySourceChart) {
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'item'
            },
            series: [{
                name: 'Khen ngợi',
                type: 'pie',
                radius: '60%',
                data: data.by_source.buckets.map(item => ({
                    value: item.doc_count,
                    name: item.key
                })),
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                }
            }],
            color: ['#00ffbb', '#52c4e1', '#4ecdc4'],
        legend: {
            textStyle: {
                color: '#ffffff'
            }
        }
        };
        charts.praiseBySourceChart.hideLoading();
        charts.praiseBySourceChart.setOption(option);
    }

    // Praise by Enterprise
    if (charts.praiseByEnterpriseChart) {
        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                axisPointer: {
                    type: 'shadow'
                }
            },
            xAxis: {
                type: 'value',
                axisLabel: {
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            yAxis: {
                type: 'category',
                data: data.by_enterprise.buckets.map(item => item.key).reverse(),
                axisLabel: {
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            series: [{
                name: 'Lời khen',
                type: 'bar',
                data: data.by_enterprise.buckets.map(item => item.doc_count).reverse(),
                itemStyle: {
                    color: new echarts.graphic.LinearGradient(1, 0, 0, 0, [
                        { offset: 0, color: '#00ffbb' },
                        { offset: 1, color: '#52c4e1' }
                    ])
                }
            }]
        };
        charts.praiseByEnterpriseChart.hideLoading();
        charts.praiseByEnterpriseChart.setOption(option);
    }
}

// Response Analysis Charts
function updateResponseAnalysisCharts(aggs) {
    // Response Rate Chart
    if (charts.responseRateChart) {
        const responseData = aggs.xi_nghiep_agg.buckets.map(item => ({
            name: item.key,
            rate: Math.floor(Math.random() * 40) + 60, // Mock response rate 60-100%
            count: item.doc_count
        }));

        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: function(params) {
                    const data = responseData[params[0].dataIndex];
                    return `${data.name}<br/>Tỷ lệ phản hồi: ${data.rate}%<br/>Tổng báo cáo: ${data.count}`;
                }
            },
            xAxis: {
                type: 'category',
                data: responseData.map(item => item.name),
                axisLabel: {
                    rotate: 45,
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            yAxis: {
                type: 'value',
                max: 100,
                axisLabel: {
                    formatter: '{value}%',
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            series: [{
                name: 'Tỷ lệ phản hồi',
                type: 'bar',
                data: responseData.map(item => item.rate),
                itemStyle: {
                    color: function(params) {
                        const value = params.value;
                        if (value >= 90) return '#52c41a';
                        if (value >= 70) return '#faad14';
                        return '#f5222d';
                    }
                }
            }]
        };
        charts.responseRateChart.hideLoading();
        charts.responseRateChart.setOption(option);
    }

    // Response Time Chart
    if (charts.responseTimeChart) {
        const timeData = aggs.xi_nghiep_agg.buckets.map(item => ({
            name: item.key,
            time: Math.floor(Math.random() * 48) + 2 // Mock response time 2-50 hours
        }));

        const option = {
            title: {
                text: '',
                left: 'center',
                textStyle: {
                    color: '#ffffff'
                }
            },
            tooltip: {
                trigger: 'axis',
                formatter: '{b}: {c} giờ'
            },
            xAxis: {
                type: 'category',
                data: timeData.map(item => item.name),
                axisLabel: {
                    rotate: 45,
                    fontSize: 10,
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                }
            },
            yAxis: {
                type: 'value',
                axisLabel: {
                    formatter: '{value}h',
                    color: '#ffffff'
                },
                axisLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.3)'
                    }
                },
                splitLine: {
                    lineStyle: {
                        color: 'rgba(0, 255, 187, 0.1)'
                    }
                }
            },
            series: [{
                name: 'Thời gian phản hồi',
                type: 'line',
                data: timeData.map(item => item.time),
                smooth: true,
                lineStyle: {
                    width: 3
                },
                symbolSize: 8,
                itemStyle: {
                    color: '#00ffbb'
                }
            }]
        };
        charts.responseTimeChart.hideLoading();
        charts.responseTimeChart.setOption(option);
    }
}

// Network Analysis Chart
function updateNetworkAnalysisChart(aggs) {
    if (!charts.networkAnalysisChart) return;

    // Create network data showing relationships between entities
    const nodes = [];
    const links = [];

    // Add enterprise nodes
    aggs.xi_nghiep_agg.buckets.slice(0, 6).forEach((enterprise, i) => {
        nodes.push({
            id: enterprise.key,
            name: enterprise.key,
            value: enterprise.doc_count,
            category: 0,
            symbolSize: Math.sqrt(enterprise.doc_count) / 2
        });
    });

    // Add source nodes
    aggs.nguon_agg.buckets.forEach((source, i) => {
        nodes.push({
            id: source.key,
            name: source.key,
            value: source.doc_count,
            category: 1,
            symbolSize: Math.sqrt(source.doc_count) / 3
        });
    });

    // Create links between enterprises and sources
    aggs.xi_nghiep_agg.buckets.slice(0, 6).forEach(enterprise => {
        aggs.nguon_agg.buckets.forEach(source => {
            links.push({
                source: enterprise.key,
                target: source.key,
                value: Math.floor(Math.random() * 500) + 100
            });
        });
    });

    const option = {
        title: {
            text: '',
            textStyle: {
                color: '#ffffff'
            },
            left: 'center'
        },
        tooltip: {},
        legend: {
            data: ['Xí nghiệp', 'Nguồn báo cáo'],
            bottom: 10
        },
        series: [{
            name: 'Mạng lưới',
            type: 'graph',
            layout: 'force',
            data: nodes,
            links: links,
            categories: [
                { name: 'Xí nghiệp' },
                { name: 'Nguồn báo cáo' }
            ],
            roam: true,
            label: {
                show: true,
                position: 'right',
                formatter: '{b}'
            },
            lineStyle: {
                color: 'source',
                curveness: 0.3
            },
            emphasis: {
                focus: 'adjacency',
                lineStyle: {
                    width: 10
                }
            },
            force: {
                repulsion: 1000,
                gravity: 0.1,
                edgeLength: 200,
                layoutAnimation: true
            }
        }],
        color: ['#3498db', '#e74c3c', '#2ecc71', '#f39c12']
    };

    charts.networkAnalysisChart.hideLoading();
    charts.networkAnalysisChart.setOption(option);
}

// Heatmap Chart
function updateHeatmapChart(aggs) {
    if (!charts.heatmapChart) return;

    // Create heatmap showing enterprise vs type intensity
    const enterprises = aggs.xi_nghiep_agg.buckets.slice(0, 8);
    const types = aggs.loai_agg.buckets.slice(0, 5);

    const data = [];
    enterprises.forEach((enterprise, i) => {
        types.forEach((type, j) => {
            data.push([i, j, Math.floor(Math.random() * enterprise.doc_count * 0.3)]);
        });
    });

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                return `${enterprises[params.data[0]].key}<br/>${types[params.data[1]].key}<br/>Số lượng: ${params.data[2]}`;
            }
        },
        grid: {
            height: '60%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: enterprises.map(item => item.key),
            splitArea: {
                show: true
            },
            axisLabel: {
                rotate: 45,
                fontSize: 10,
                color: '#ffffff'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: types.map(item => item.key),
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: Math.max(...data.map(item => item[2])),
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%'
        },
        series: [{
            name: 'Báo cáo',
            type: 'heatmap',
            data: data,
            label: {
                show: true
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    charts.heatmapChart.hideLoading();
    charts.heatmapChart.setOption(option);
}

// Correlation Chart
function updateCorrelationChart(aggs) {
    if (!charts.correlationChart) return;

    // Create correlation matrix between different metrics
    const metrics = ['Nguồn', 'Loại', 'Cấp độ', 'Đối tượng'];
    const correlationData = [
        [1.00, 0.75, 0.45, 0.32],
        [0.75, 1.00, 0.68, 0.54],
        [0.45, 0.68, 1.00, 0.43],
        [0.32, 0.54, 0.43, 1.00]
    ];

    const data = [];
    correlationData.forEach((row, i) => {
        row.forEach((value, j) => {
            data.push([i, j, value]);
        });
    });

    const option = {
        title: {
            text: '',
            left: 'center',
            textStyle: {
                color: '#ffffff'
            }
        },
        tooltip: {
            position: 'top',
            formatter: function(params) {
                return `${metrics[params.data[0]]} vs ${metrics[params.data[1]]}<br/>Tương quan: ${params.data[2].toFixed(2)}`;
            }
        },
        grid: {
            height: '60%',
            top: '10%'
        },
        xAxis: {
            type: 'category',
            data: metrics,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        yAxis: {
            type: 'category',
            data: metrics,
            splitArea: {
                show: true
            },
            axisLabel: {
                color: '#ffffff',
                textShadowBlur: 0,
                textShadowColor: 'transparent'
            },
            axisLine: {
                lineStyle: {
                    color: 'rgba(0, 255, 187, 0.3)'
                }
            }
        },
        visualMap: {
            min: 0,
            max: 1,
            calculable: true,
            orient: 'horizontal',
            left: 'center',
            bottom: '15%',
            color: ['#00ffbb', '#52c4e1', '#4ecdc4', '#48cae4']
        },
        series: [{
            name: 'Tương quan',
            type: 'heatmap',
            data: data,
            label: {
                show: true,
                formatter: function(params) {
                    return params.data[2].toFixed(2);
                }
            },
            emphasis: {
                itemStyle: {
                    shadowBlur: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };

    charts.correlationChart.hideLoading();
    charts.correlationChart.setOption(option);
}

// Export specific reports to Excel
function exportSpecificReport(reportType) {
    if (!lastFetchedData) {
        showError('Chưa có dữ liệu để xuất. Vui lòng làm mới dữ liệu trước.');
        return;
    }

    const aggs = lastFetchedData.aggregations;
    let workbook, worksheets;

    switch(reportType) {
        case 'source-analysis':
            workbook = createSourceAnalysisWorkbook(aggs);
            break;
        case 'target-analysis':
            workbook = createTargetAnalysisWorkbook(aggs);
            break;
        case 'route-analysis':
            workbook = createRouteAnalysisWorkbook(aggs);
            break;
        case 'enterprise-analysis':
            workbook = createEnterpriseAnalysisWorkbook(aggs);
            break;
        case 'praise-analysis':
            workbook = createPraiseAnalysisWorkbook(aggs);
            break;
        case 'comprehensive':
            workbook = createComprehensiveWorkbook(aggs);
            break;
        default:
            showError('Loại báo cáo không được hỗ trợ');
            return;
    }

    // Download the Excel file
    XLSX.writeFile(workbook, `bao_cao_${reportType}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Export all data to Excel
function exportAllToExcel() {
    if (!lastFetchedData) {
        showError('Chưa có dữ liệu để xuất. Vui lòng làm mới dữ liệu trước.');
        return;
    }

    const aggs = lastFetchedData.aggregations;
    const workbook = createComprehensiveWorkbook(aggs);

    XLSX.writeFile(workbook, `bao_cao_tong_hop_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Create Source Analysis Workbook
function createSourceAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    // Source distribution sheet
    const sourceData = [
        ['Nguồn', 'Số lượng', 'Tỷ lệ %'],
        ...aggs.nguon_agg.buckets.map(item => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2)
        ])
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sourceData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích nguồn');

    return wb;
}

// Create Target Analysis Workbook
function createTargetAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    // Target distribution
    const targetData = [
        ['Đối tượng', 'Số lượng', 'Tỷ lệ %'],
        ...aggs.doi_tuong_agg.buckets.map(item => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2)
        ])
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(targetData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích đối tượng');

    return wb;
}

// Create Route Analysis Workbook
function createRouteAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    const routeData = [
        ['Tuyến', 'Số báo cáo', 'Mức độ ưu tiên'],
        ...aggs.tuyen_agg.buckets.map((item, index) => [
            item.key,
            item.doc_count,
            index < 5 ? 'Cao' : index < 10 ? 'Trung bình' : 'Thấp'
        ])
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(routeData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích tuyến');

    return wb;
}

// Create Enterprise Analysis Workbook
function createEnterpriseAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    const enterpriseData = [
        ['Xí nghiệp', 'Số báo cáo', 'Tỷ lệ %', 'Xếp hạng'],
        ...aggs.xi_nghiep_agg.buckets.map((item, index) => [
            item.key,
            item.doc_count,
            ((item.doc_count / aggs.total_records.value) * 100).toFixed(2),
            index + 1
        ])
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(enterpriseData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích xí nghiệp');

    return wb;
}

// Create Praise Analysis Workbook
function createPraiseAnalysisWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    if (aggs.praise_analysis) {
        const praiseData = [
            ['Xí nghiệp', 'Số lời khen', 'Nguồn chính'],
            ...aggs.praise_analysis.by_enterprise.buckets.map(item => [
                item.key,
                item.doc_count,
                'Đa nguồn' // Could be enhanced with actual source analysis
            ])
        ];

        const ws1 = XLSX.utils.aoa_to_sheet(praiseData);
        XLSX.utils.book_append_sheet(wb, ws1, 'Phân tích khen ngợi');
    }

    return wb;
}

// Create Comprehensive Workbook
function createComprehensiveWorkbook(aggs) {
    const wb = XLSX.utils.book_new();

    // Summary sheet
    const summaryData = [
        ['Chỉ số', 'Giá trị'],
        ['Tổng số báo cáo', aggs.total_records.value],
        ['Số xí nghiệp', aggs.xi_nghiep_agg.buckets.length],
        ['Số tuyến', aggs.tuyen_agg.buckets.length],
        ['Số nguồn', aggs.nguon_agg.buckets.length],
        ['Tỷ lệ đã xử lý', ((aggs.trang_thai_agg.buckets.find(b => b.key === 'Đã xử lý')?.doc_count || 0) / aggs.total_records.value * 100).toFixed(2) + '%']
    ];

    const ws_summary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws_summary, 'Tổng quan');

    // Add other sheets
    const sourceWb = createSourceAnalysisWorkbook(aggs);
    const targetWb = createTargetAnalysisWorkbook(aggs);
    const routeWb = createRouteAnalysisWorkbook(aggs);
    const enterpriseWb = createEnterpriseAnalysisWorkbook(aggs);

    // Copy sheets from other workbooks
    if (sourceWb.Sheets['Phân tích nguồn']) {
        XLSX.utils.book_append_sheet(wb, sourceWb.Sheets['Phân tích nguồn'], 'Nguồn');
    }
    if (targetWb.Sheets['Phân tích đối tượng']) {
        XLSX.utils.book_append_sheet(wb, targetWb.Sheets['Phân tích đối tượng'], 'Đối tượng');
    }
    if (routeWb.Sheets['Phân tích tuyến']) {
        XLSX.utils.book_append_sheet(wb, routeWb.Sheets['Phân tích tuyến'], 'Tuyến');
    }
    if (enterpriseWb.Sheets['Phân tích xí nghiệp']) {
        XLSX.utils.book_append_sheet(wb, enterpriseWb.Sheets['Phân tích xí nghiệp'], 'Xí nghiệp');
    }

    return wb;
}

// Global chart enhancement configuration
const CHART_ENHANCEMENTS = {
    tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        borderColor: 'rgba(100, 200, 255, 0.4)',
        borderWidth: 1,
        borderRadius: 12,
        textStyle: {
            color: '#ffffff',
            fontSize: 13,
            fontFamily: 'Inter, sans-serif'
        },
        extraCssText: 'backdrop-filter: blur(20px); box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); padding: 15px;'
    },
    colors: ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'],
    animation: {
        animationDuration: 1000,
        animationEasing: 'elasticOut',
        animationDelay: function (idx) {
            return idx * 80;
        }
    }
};

// Apply enhancements to all charts after initialization
function applyChartEnhancements() {
    Object.keys(charts).forEach(chartId => {
        if (charts[chartId]) {
            // Add hover effects
            charts[chartId].on('mouseover', function(params) {
                if (params.componentType === 'series') {
                    document.body.style.cursor = 'pointer';
                }
            });

            charts[chartId].on('mouseout', function(params) {
                document.body.style.cursor = 'default';
            });
        }
    });
}

// Enhanced tooltip and interaction configuration
function enhanceAllCharts() {
    const enhancedColors = ['#64c8ff', '#00ffc8', '#ff9664', '#a855f7', '#f59e0b', '#ef4444', '#06b6d4', '#8b5cf6'];

    Object.keys(charts).forEach((chartId, index) => {
        if (charts[chartId] && !charts[chartId].isDisposed()) {
            // Add enhanced interactions
            charts[chartId].on('mouseover', function(params) {
                if (params.componentType === 'series') {
                    document.body.style.cursor = 'pointer';
                }
            });

            charts[chartId].on('mouseout', function(params) {
                document.body.style.cursor = 'default';
            });

            // Add click interactions for detailed view
            charts[chartId].on('click', function(params) {
                if (params.componentType === 'series') {
                    showDetailedTooltip(params, chartId);
                }
            });
        }
    });
}

// Show detailed tooltip on click
function showDetailedTooltip(params, chartId) {
    const tooltipDiv = document.createElement('div');
    tooltipDiv.className = 'custom-detailed-tooltip';
    tooltipDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.95);
        border: 1px solid rgba(100, 200, 255, 0.4);
        border-radius: 16px;
        padding: 25px;
        color: white;
        font-family: Inter, sans-serif;
        backdrop-filter: blur(25px);
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8);
        z-index: 10000;
        max-width: 400px;
        animation: fadeInScale 0.3s ease-out;
    `;

    tooltipDiv.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <h3 style="color: #64c8ff; margin: 0 0 10px 0; font-size: 18px;">📊 Thông tin chi tiết</h3>
            <div style="color: #00ffc8; font-weight: 600; font-size: 16px;">${params.name}</div>
        </div>
        <div style="line-height: 1.8; font-size: 14px;">
            <div>📈 Giá trị: <span style="color: #00ffc8; font-weight: 600;">${params.value?.toLocaleString() || 'N/A'}</span></div>
            ${params.percent ? `<div>📊 Tỷ lệ: <span style="color: #ff9664; font-weight: 600;">${params.percent}%</span></div>` : ''}
            <div>📋 Loại biểu đồ: <span style="color: #64c8ff;">${chartId.replace('Chart', '')}</span></div>
            <div>⏰ Thời gian: <span style="color: #a855f7;">${new Date().toLocaleString('vi-VN')}</span></div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
            <button onclick="this.parentElement.parentElement.remove()"
                    style="background: linear-gradient(135deg, #64c8ff, #00ffc8);
                           border: none;
                           padding: 10px 20px;
                           border-radius: 8px;
                           color: white;
                           font-weight: 600;
                           cursor: pointer;
                           font-family: Inter, sans-serif;">
                Đóng
            </button>
        </div>
    `;

    document.body.appendChild(tooltipDiv);

    // Auto remove after 10 seconds
    setTimeout(() => {
        if (tooltipDiv.parentElement) {
            tooltipDiv.remove();
        }
    }, 10000);
}

// Add CSS animation for tooltip
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeInScale {
        0% {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.8);
        }
        100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
        }
    }
`;
document.head.appendChild(style);

// Debug function to check app status
function debugAppStatus() {
    console.log('=== ECharts Dashboard Debug Info ===');
    console.log('Charts initialized:', Object.keys(charts).length);
    console.log('Available charts:', Object.keys(charts));

    // Check which tabs are active
    const activeTab = document.querySelector('.tab-content.active');
    console.log('Active tab:', activeTab ? activeTab.id : 'none');

    // Check chart dimensions
    Object.entries(charts).forEach(([id, chart]) => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`Chart ${id}: ${element.offsetWidth}x${element.offsetHeight}, isDisposed: ${chart.isDisposed()}`);
        }
    });

    // Check data status
    console.log('Last fetched data available:', !!lastFetchedData);

    console.log('=====================================');
}

// Global function to fix all chart dimensions (emergency fix)
function fixAllChartDimensions() {
    console.log('🚨 Emergency fix: Resetting all chart dimensions...');

    Object.keys(charts).forEach(chartId => {
        const element = document.getElementById(chartId);
        const chart = charts[chartId];

        if (element && chart && !chart.isDisposed()) {
            try {
                // Reset container
                const container = element.closest('.chart-container');
                if (container) {
                    container.style.height = 'auto';
                    container.style.minHeight = '450px';
                    container.style.maxHeight = '600px';
                }

                // Reset chart element
                element.style.height = '400px';
                element.style.minHeight = '400px';
                element.style.maxHeight = '500px';
                element.style.width = '100%';

                // Force resize
                setTimeout(() => {
                    const width = element.offsetWidth || 600;
                    const height = Math.min(element.offsetHeight || 400, 500);

                    chart.resize({
                        width: width,
                        height: height,
                        silent: true
                    });

                    console.log(`🔧 Fixed ${chartId}: ${width}x${height}`);
                }, 50);

            } catch (error) {
                console.error(`Error fixing chart ${chartId}:`, error);
            }
        }
    });

    console.log('✅ All chart dimensions reset completed');
}

// Show keyboard shortcuts notification
function showKeyboardShortcutsNotification() {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(30, 30, 40, 0.95));
        backdrop-filter: blur(20px);
        border: 1px solid rgba(100, 200, 255, 0.3);
        color: white;
        padding: 20px;
        border-radius: 12px;
        font-family: Inter, sans-serif;
        font-size: 14px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        max-width: 300px;
        animation: slideInNotification 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="color: #64c8ff; font-weight: 700; margin-bottom: 12px; font-size: 16px;">
            ⌨️ Keyboard Shortcuts
        </div>
        <div style="line-height: 1.6;">
            <div><strong>Ctrl+Shift+D:</strong> Debug charts</div>
            <div><strong>Ctrl+Shift+A:</strong> Toggle animations</div>
            <div><strong>Ctrl+Shift+R:</strong> Force refresh</div>
            <div style="color: #00ffc8;"><strong>Ctrl+Shift+F:</strong> Fix chart sizes</div>
        </div>
        <div style="margin-top: 12px; font-size: 12px; color: #888; text-align: center;">
            Charts are now size-constrained to prevent stretching
        </div>
    `;

    // Add CSS animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInNotification {
            0% { transform: translateX(100%); opacity: 0; }
            100% { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    document.body.appendChild(notification);

    // Auto remove after 8 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideInNotification 0.3s ease-in reverse';
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 300);
        }
    }, 8000);
}

// Add debug functions to window for testing
window.debugAppStatus = debugAppStatus;
window.fixAllChartDimensions = fixAllChartDimensions;

// Page visibility handling
document.addEventListener('visibilitychange', function() {
    pageVisible = !document.hidden;
    console.log(`Page visibility changed: ${pageVisible ? 'visible' : 'hidden'}`);

    if (!pageVisible) {
        // Pause any running animations or updates
        Object.values(charts).forEach(chart => {
            if (chart && !chart.isDisposed()) {
                chart.setOption({ animation: false });
            }
        });
    } else {
        // Resume animations if enabled
        if (PERFORMANCE_CONFIG.ENABLE_ANIMATIONS) {
            Object.values(charts).forEach(chart => {
                if (chart && !chart.isDisposed()) {
                    chart.setOption({ animation: true });
                }
            });
        }
    }
});

// Additional DOMContentLoaded listener for critical functionality
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Additional DOM initialization started');

    // Ensure sidebar functionality is properly initialized
    setTimeout(() => {
        initializeSidebarCollapse();
        console.log('✅ Sidebar functionality re-initialized');
    }, 100);

    // Initialize critical event listeners
    const refreshBtn = document.getElementById('refreshData');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', fetchDataAndUpdateCharts);
        console.log('✅ Refresh button initialized');
    }

    const exportBtn = document.getElementById('exportExcel');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToExcel);
        console.log('✅ Export button initialized');
    }

    // Fix tab navigation if not working
    const menuLinks = document.querySelectorAll('.menu-link');
    menuLinks.forEach(link => {
        // Remove existing listeners to prevent duplicates
        link.removeEventListener('click', handleTabClick);
        link.addEventListener('click', handleTabClick);
    });

    console.log('✅ Additional DOM initialization completed');

    // Final check and fix for charts after everything is loaded
    setTimeout(() => {
        fixChartsAfterLoad();
    }, 1000);
});

// Tab click handler function
function handleTabClick(e) {
    e.preventDefault();
    const targetTab = this.getAttribute('data-tab');
    if (targetTab) {
        showTab(targetTab);

        // Update active state
        document.querySelectorAll('.menu-link').forEach(link => link.classList.remove('active'));
        this.classList.add('active');

        console.log(`📱 Switched to tab: ${targetTab}`);

        // Ensure charts in the new tab are visible and responsive
        setTimeout(() => {
            checkAndFixChartsInTab(targetTab);
        }, 200);
    }
}

// Function to fix charts after page load
function fixChartsAfterLoad() {
    console.log('🔧 Final chart check and fix...');

    // Check all chart containers for visibility issues
    const allChartIds = Object.values(CHARTS_BY_TAB).flat();
    let fixedCharts = 0;

    allChartIds.forEach(chartId => {
        const element = document.getElementById(chartId);
        const chart = charts[chartId];

        if (element && chart && !chart.isDisposed()) {
            // Check if chart has no data or is empty
            try {
                const option = chart.getOption();
                if (!option || Object.keys(option).length === 0) {
                    console.warn(`🔧 Chart ${chartId} has no options, reinitializing...`);
                    chart.dispose();
                    initializeChart(chartId);
                    fixedCharts++;
                }
            } catch (error) {
                console.warn(`🔧 Chart ${chartId} has errors, reinitializing...`, error);
                chart.dispose();
                initializeChart(chartId);
                fixedCharts++;
            }
        } else if (element && !chart) {
            console.warn(`🔧 Chart ${chartId} missing, initializing...`);
            initializeChart(chartId);
            fixedCharts++;
        }
    });

    if (fixedCharts > 0) {
        console.log(`🔧 Fixed ${fixedCharts} charts`);
        // Re-run data load after fixes
        setTimeout(() => {
            fetchDataAndUpdateCharts();
        }, 500);
    } else {
        console.log('✅ All charts are working properly');
    }
}

// Function to check and fix charts in a specific tab with height constraints
function checkAndFixChartsInTab(tabName) {
    const tabCharts = CHARTS_BY_TAB[tabName] || [];
    let fixedInTab = 0;

    console.log(`🔧 Checking and fixing ${tabCharts.length} charts in tab: ${tabName}`);

    tabCharts.forEach(chartId => {
        const element = document.getElementById(chartId);
        const chart = charts[chartId];

        if (element && chart && !chart.isDisposed()) {
            try {
                // Force proper container and element dimensions
                const container = element.closest('.chart-container');
                if (container) {
                    // Reset container height to prevent stretching
                    container.style.height = 'auto';
                    container.style.minHeight = '450px';
                    container.style.maxHeight = '600px';
                }

                // Set fixed chart dimensions
                element.style.height = '400px';
                element.style.minHeight = '400px';
                element.style.maxHeight = '500px';
                element.style.width = '100%';

                // Force resize with proper dimensions
                setTimeout(() => {
                    const width = element.offsetWidth || 600;
                    const height = Math.min(element.offsetHeight || 400, 500);

                    chart.resize({
                        width: width,
                        height: height,
                        silent: true
                    });

                    console.log(`🔧 Fixed chart ${chartId} dimensions: ${width}x${height}`);
                    fixedInTab++;
                }, 100);

            } catch (error) {
                console.warn(`🔧 Error fixing chart ${chartId}:`, error);
            }
        } else if (element && !chart) {
            console.warn(`🔧 Chart ${chartId} missing, needs initialization`);
            fixedInTab++;
        }
    });

    if (fixedInTab > 0) {
        console.log(`🔧 Fixed ${fixedInTab} charts in tab: ${tabName}`);
    } else {
        console.log(`✅ All charts in tab ${tabName} are properly sized`);
    }
}

// Enhanced floating particles animation
function createEnhancedFloatingParticles() {
    if (!PERFORMANCE_CONFIG.ENABLE_ANIMATIONS || typeof Motion === 'undefined') {
        console.log('Floating particles disabled - animations off or Motion.js unavailable');
        return;
    }

    try {
        console.log('🌟 Creating enhanced floating particles...');

        // Create subtle floating elements
        for (let i = 0; i < 6; i++) {
            const particle = document.createElement('div');
            particle.style.cssText = `
                position: fixed;
                width: 3px;
                height: 3px;
                background: radial-gradient(circle, #64c8ff60, transparent);
                border-radius: 50%;
                pointer-events: none;
                z-index: 1;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
            `;
            document.body.appendChild(particle);

            // Animate particle
            Motion.animate(particle, {
                y: [0, -80, 0],
                x: [0, Math.random() * 40 - 20, 0],
                opacity: [0, 0.4, 0],
                scale: [0, 1, 0]
            }, {
                duration: 12 + Math.random() * 6,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: Math.random() * 3
            });
        }
    } catch (error) {
        console.log('Enhanced floating particles error:', error);
    }
}

// Initialize tools dropdown menu
function initializeToolsMenu() {
    const toolsMenuBtn = document.getElementById('toolsMenuBtn');
    const toolsDropdown = document.getElementById('toolsDropdown');
    const animationToggleText = document.getElementById('animationToggleText');

    if (!toolsMenuBtn || !toolsDropdown) {
        console.warn('Tools menu elements not found');
        return;
    }

    // Update animation toggle text based on current state
    function updateAnimationToggleText() {
        if (animationToggleText) {
            animationToggleText.textContent = PERFORMANCE_CONFIG.ENABLE_ANIMATIONS
                ? 'Disable Animations'
                : 'Enable Animations';
        }
    }

    // Initially update text
    updateAnimationToggleText();

    // Toggle dropdown
    toolsMenuBtn.addEventListener('click', function(e) {
        e.stopPropagation();

        const isDropdownOpen = toolsDropdown.classList.contains('show');
        const wrapper = toolsMenuBtn.closest('.tools-menu-wrapper');

        if (isDropdownOpen) {
            toolsDropdown.classList.remove('show');
            wrapper.classList.remove('dropdown-open');
        } else {
            toolsDropdown.classList.add('show');
            wrapper.classList.add('dropdown-open');
        }

        // Animate button
        if (PERFORMANCE_CONFIG.ENABLE_ANIMATIONS && typeof Motion !== 'undefined') {
            try {
                Motion.animate(toolsMenuBtn, {
                    scale: [1, 1.05, 1]
                }, {
                    duration: 0.2,
                    ease: 'easeInOut'
                });
            } catch (error) {
                console.log('Tools button animation error:', error);
            }
        }
    });

    // Handle dropdown item clicks
    toolsDropdown.addEventListener('click', function(e) {
        const item = e.target.closest('.dropdown-item');
        if (!item) return;

        const action = item.getAttribute('data-action');

        switch (action) {
            case 'debug-charts':
                console.log('🔍 DEBUG: Checking all charts status...');
                debugChartsStatus();
                showToolsNotification('Charts status logged to console', '📊');
                break;

            case 'toggle-animations':
                toggleAnimations();
                updateAnimationToggleText();
                const state = PERFORMANCE_CONFIG.ENABLE_ANIMATIONS ? 'enabled' : 'disabled';
                showToolsNotification(`Animations ${state}`, '🎬');
                break;

            case 'force-refresh':
                console.log('🎬 Force refresh with animations...');
                animateDataRefresh();
                setTimeout(() => {
                    const mockData = generateEnhancedMockData();
                    lastFetchedData = mockData;
                    forceUpdateAllCharts(mockData);
                    updateStatsWithAnimation(mockData.aggregations);
                    updateLastUpdateTime();
                }, 200);
                showToolsNotification('Data refreshed with animations', '🔄');
                break;

            case 'fix-dimensions':
                console.log('🔧 Emergency fix: Resetting all chart dimensions...');
                fixAllChartDimensions();
                showToolsNotification('Chart dimensions fixed', '🔧');
                break;
        }

        // Close dropdown after action
        const wrapper = toolsMenuBtn.closest('.tools-menu-wrapper');
        toolsDropdown.classList.remove('show');
        wrapper.classList.remove('dropdown-open');
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function(e) {
        const wrapper = toolsMenuBtn.closest('.tools-menu-wrapper');
        if (!toolsMenuBtn.contains(e.target) && !toolsDropdown.contains(e.target)) {
            toolsDropdown.classList.remove('show');
            wrapper.classList.remove('dropdown-open');
        }
    });

    console.log('✅ Tools menu initialized');
}

// Show notification for tools actions
function showToolsNotification(message, icon = '🛠️') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        background: linear-gradient(135deg, rgba(10, 10, 15, 0.95), rgba(30, 30, 40, 0.95));
        backdrop-filter: blur(20px);
        border: 1px solid rgba(100, 200, 255, 0.3);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        font-family: Inter, sans-serif;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        max-width: 300px;
        animation: slideInNotification 0.5s ease-out;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 18px;">${icon}</span>
            <span style="color: #e4e4e7;">${message}</span>
        </div>
    `;

    document.body.appendChild(notification);

    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.animation = 'slideOutNotification 0.5s ease-in forwards';
            setTimeout(() => {
                notification.remove();
            }, 500);
        }
    }, 3000);

    // Add click to dismiss
    notification.addEventListener('click', () => {
        notification.remove();
    });
}

// Ensure CSS keyframes exist for notifications
if (!document.querySelector('#notification-styles')) {
    const notificationStyles = document.createElement('style');
    notificationStyles.id = 'notification-styles';
    notificationStyles.textContent = `
        @keyframes slideInNotification {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOutNotification {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(notificationStyles);
}
