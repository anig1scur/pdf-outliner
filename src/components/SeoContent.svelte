<script lang="ts">
  import { t } from 'svelte-i18n';
</script>

<div class="w-full max-w-5xl mx-auto px-4 py-12 md:py-20 space-y-20 text-gray-800">
  <!-- Why Use Section -->
  <section class="text-center space-y-6">
    <h2 class="text-3xl md:text-4xl font-bold tracking-tight">{$t('seo.why_title')}</h2>
    <p class="max-w-3xl mx-auto text-lg md:text-xl text-gray-600 leading-relaxed">
      {$t('seo.why_desc')}
    </p>
  </section>

  <!-- Key Features -->
  <section>
    <h2 class="text-3xl font-bold text-center mb-10">{$t('seo.features_title')}</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-xl font-semibold mb-3">{$t('seo.feature_1_title')}</h3>
        <p class="text-gray-600">{$t('seo.feature_1_desc')}</p>
      </div>
      <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-xl font-semibold mb-3">{$t('seo.feature_2_title')}</h3>
        <p class="text-gray-600">{$t('seo.feature_2_desc')}</p>
      </div>
      <div class="bg-gray-50 p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
        <h3 class="text-xl font-semibold mb-3">{$t('seo.feature_3_title')}</h3>
        <p class="text-gray-600">{$t('seo.feature_3_desc')}</p>
      </div>
    </div>
  </section>

  <!-- How to Section -->
  <section class="bg-slate-900 text-white rounded-3xl p-8 md:p-12">
    <h2 class="text-3xl font-bold text-center mb-12">{$t('seo.how_title')}</h2>
    <div class="grid md:grid-cols-4 gap-8">
      <div class="space-y-3 relative">
        <div class="text-5xl font-bold text-blue-500 opacity-50 absolute -top-8 -left-4">01</div>
        <p class="relative z-10 font-medium text-lg pt-4">{$t('seo.how_step_1')}</p>
      </div>
      <div class="space-y-3 relative">
        <div class="text-5xl font-bold text-blue-500 opacity-50 absolute -top-8 -left-4">02</div>
        <p class="relative z-10 font-medium text-lg pt-4">{$t('seo.how_step_2')}</p>
      </div>
      <div class="space-y-3 relative">
        <div class="text-5xl font-bold text-blue-500 opacity-50 absolute -top-8 -left-4">03</div>
        <p class="relative z-10 font-medium text-lg pt-4">{$t('seo.how_step_3')}</p>
      </div>
      <div class="space-y-3 relative">
        <div class="text-5xl font-bold text-blue-500 opacity-50 absolute -top-8 -left-4">04</div>
        <p class="relative z-10 font-medium text-lg pt-4">{$t('seo.how_step_4')}</p>
      </div>
    </div>
  </section>

  <!-- FAQ -->
  <section class="max-w-3xl mx-auto">
    <h2 class="text-3xl font-bold text-center mb-10">{$t('seo.faq_title')}</h2>
    <div class="space-y-6">
      <div class="border-b border-gray-200 pb-6">
        <h3 class="text-xl font-semibold mb-2">{$t('seo.faq_1_q')}</h3>
        <p class="text-gray-600">{$t('seo.faq_1_a')}</p>
      </div>
      <div class="border-b border-gray-200 pb-6">
        <h3 class="text-xl font-semibold mb-2">{$t('seo.faq_2_q')}</h3>
        <p class="text-gray-600">{$t('seo.faq_2_a')}</p>
      </div>
    </div>
  </section>
</div>
