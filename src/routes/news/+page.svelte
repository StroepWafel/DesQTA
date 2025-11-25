<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { cache } from '../../utils/cache';
  import { getRSS } from '../../utils/netUtil';
  import { invoke } from '@tauri-apps/api/core';
  import T from '$lib/components/T.svelte';
  import { _ } from '../../lib/i18n';
  import { logger } from '../../utils/logger';

  interface NewsArticle {
    title: string;
    description: string;
    url: string;
    urlToImage: string | null;
  }

  let loading = true;
  let error: string | null = null;
  let news: NewsArticle[] = [];
  let selectedSource = 'australia';
  let showSourceSelector = false;

  const rssFeedsByCountry: Record<string, string[]> = {
    usa: [
      'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
      'https://www.huffpost.com/section/front-page/feed',
      'https://www.npr.org/rss/rss.php',
    ],
    taiwan: [
      'https://news.ltn.com.tw/rss/all.xml',
      'https://www.taipeitimes.com/xml/index.rss',
      'https://international.thenewslens.com/rss',
    ],
    hong_kong: [
      'https://rthk9.rthk.hk/rthk/news/rss/e_expressnews_elocal.xml',
      'https://www.scmp.com/rss/91/feed',
    ],
    panama: [
      'https://critica.com.pa/rss.xml',
      'https://www.panamaamerica.com.pa/rss.xml',
      'https://noticiassin.com/feed/',
      'https://elcapitalfinanciero.com/feed/',
    ],
    canada: [
      'https://www.cbc.ca/cmlink/rss-topstories',
      'https://calgaryherald.com/feed',
      'https://ottawacitizen.com/feed',
      'https://www.montrealgazette.com/feed',
    ],
    singapore: [
      'https://www.straitstimes.com/news/singapore/rss.xml',
      'https://www.channelnewsasia.com/rssfeeds/8395986',
    ],
    uk: ['http://feeds.bbci.co.uk/news/rss.xml', 'https://www.theguardian.com/uk/rss'],
    japan: [
      'https://www3.nhk.or.jp/nhkworld/en/news/feeds/',
      'https://news.livedoor.com/topics/rss/int.xml',
    ],
    netherlands: ['https://www.dutchnews.nl/feed/', 'https://www.nrc.nl/rss/'],
  };

  const fetchAustraliaNews = async (from: string, domains: string) => {
    try {
      const response = await invoke<any>('get_news_australia', { from, domains });
      return response;
    } catch (error) {
      logger.error('news', 'fetchAustraliaNews', `Error fetching Australian news: ${error}`, { error });
      throw error;
    }
  };

  const fetchNews = async (source: string) => {
    try {
      // Check cache first
      const cacheKey = `news_${source}`;
      const cachedNews = cache.get<NewsArticle[]>(cacheKey);
      if (cachedNews) {
        news = cachedNews;
        return;
      }

      if (source === 'australia') {
        const date = new Date();
        const from = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate() - 5}`;
        const response = await fetchAustraliaNews(from, 'abc.net.au');
        news = (response && response.articles) ? response.articles : [];
      } else {
        let feeds: string[];

        if (rssFeedsByCountry[source.toLowerCase()]) {
          feeds = rssFeedsByCountry[source.toLowerCase()];
        } else if (source.startsWith('http')) {
          feeds = [source];
        } else {
          throw new Error('Invalid source. Provide a country code or a valid RSS feed URL.');
        }

        const articlesPromises = feeds.map(async (feedUrl) => {
          try {
            const feed = await getRSS(feedUrl);
            if (!feed || !feed.items || !Array.isArray(feed.items)) {
              logger.warn('news', 'fetchNews', `Invalid feed format from ${feedUrl}`, { feedUrl });
              return [];
            }
            return feed.items.map((item: any) => ({
              title: item.title || 'No Title',
              description: item.description || item.contentSnippet || 'No description available',
              url: item.link || feedUrl,
              urlToImage: null,
            }));
          } catch (error) {
            logger.error('news', 'fetchNews', `Failed to fetch RSS feed: ${feedUrl}`, { feedUrl, error });
            return [];
          }
        });

        const articlesArray = await Promise.all(articlesPromises);
        news = articlesArray.flat().filter((article) => article.title !== 'No Title');

        if (news.length === 0) {
          error = $_('news.no_articles_loaded') || 'No articles could be loaded from the selected sources.';
        }
      }

      // Cache the results for 30 minutes
      cache.set(cacheKey, news, 30 * 60 * 1000);
    } catch (err) {
      error = err instanceof Error ? err.message : $_('news.failed_to_fetch') || 'Failed to fetch news';
      news = [];
    } finally {
      loading = false;
    }
  };

  const handleSourceChange = async (source: string) => {
    loading = true;
    error = null;
    selectedSource = source;
    showSourceSelector = false;
    await fetchNews(source);
  };

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    const dropdown = document.getElementById('source-dropdown');
    const button = document.getElementById('source-button');

    if (dropdown && button && !dropdown.contains(target) && !button.contains(target)) {
      showSourceSelector = false;
    }
  }

  let clickOutsideHandler: (event: MouseEvent) => void;

  onMount(() => {
    fetchNews(selectedSource);
    clickOutsideHandler = handleClickOutside;
    document.addEventListener('click', clickOutsideHandler);
  });

  onDestroy(() => {
    if (clickOutsideHandler) {
      document.removeEventListener('click', clickOutsideHandler);
    }
  });
</script>

<div class="container px-6 py-7 mx-auto">
  <div class="flex justify-between items-center mb-8">
    <h1 class="text-2xl font-bold text-zinc-900 dark:text-white">
      <T key="navigation.news" fallback="News" />
    </h1>
    <div class="relative">
      <button
        id="source-button"
        class="px-4 py-2 bg-white rounded-lg border transition-colors text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700 focus:ring-2 focus:ring-blue-500"
        on:click={() => (showSourceSelector = !showSourceSelector)}>
        {selectedSource.toUpperCase()}
      </button>
      {#if showSourceSelector}
        <div
          id="source-dropdown"
          class="absolute right-0 z-10 mt-2 w-48 bg-white rounded-lg border shadow-xl text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-white dark:border-zinc-700"
          transition:fade>
          {#each Object.keys(rssFeedsByCountry) as country}
            <button
              class="px-4 py-2 w-full text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-700 first:rounded-t-lg last:rounded-b-lg"
              on:click={() => handleSourceChange(country)}>
              {country.toUpperCase()}
            </button>
          {/each}
          <button
            class="px-4 py-2 w-full text-left border-t transition-colors border-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 dark:border-zinc-700"
            on:click={() => handleSourceChange('australia')}>
            AUSTRALIA
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="flex justify-center items-center h-64">
      <div class="w-12 h-12 rounded-full border-b-4 border-blue-500 animate-spin"></div>
    </div>
  {:else if error}
    <div class="py-8 text-center">
      <p class="mb-4 text-red-400">{error}</p>
      <button
        class="px-4 py-2 text-white bg-blue-600 rounded-lg transition-colors hover:bg-blue-700"
        on:click={() => fetchNews(selectedSource)}>
        <T key="common.retry" fallback="Retry" />
      </button>
    </div>
  {:else if news.length === 0}
    <div class="py-8 text-center">
      <p class="text-zinc-400">
        <T key="news.no_articles_found" fallback="No news articles found." />
      </p>
    </div>
  {:else}
    <div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
      {#each news as article (article.url)}
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          class="group block dark:bg-zinc-900 bg-zinc-100 border dark:border-zinc-800 border-zinc-200 rounded-xl shadow-2xl hover:scale-[1.025] hover:shadow-blue-900/30 transition-all duration-200 overflow-hidden focus:ring-2 focus:ring-blue-500"
          transition:fade>
          <div class="relative">
            {#if article.urlToImage}
              <img
                src={article.urlToImage}
                alt={article.title}
                class="object-cover w-full h-48 rounded-t-xl" />
            {/if}
          </div>
          <div class="p-5">
            <h2 class="mb-2 text-lg font-semibold dark:text-white line-clamp-2">
              {article.title}
            </h2>
            <p class="dark:text-zinc-300 text-zinc-700 line-clamp-3">
              {article.description}
            </p>
          </div>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .line-clamp-3 {
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
