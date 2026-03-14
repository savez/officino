<script setup>
const props = defineProps({
  page: { type: Number, required: true },
  totalPages: { type: Number, required: true },
  perPage: { type: Number, default: 20 },
})

const emit = defineEmits(['update:page'])

function goTo(p) {
  if (p >= 1 && p <= props.totalPages) {
    emit('update:page', p)
  }
}
</script>

<template>
  <nav v-if="totalPages > 1" aria-label="Paginazione">
    <ul class="pagination pagination-sm justify-content-center mb-0">
      <li class="page-item" :class="{ disabled: page <= 1 }">
        <a class="page-link" href="#" @click.prevent="goTo(page - 1)">
          &laquo;
        </a>
      </li>

      <li
        v-for="p in totalPages"
        :key="p"
        class="page-item"
        :class="{ active: p === page }"
      >
        <a class="page-link" href="#" @click.prevent="goTo(p)">{{ p }}</a>
      </li>

      <li class="page-item" :class="{ disabled: page >= totalPages }">
        <a class="page-link" href="#" @click.prevent="goTo(page + 1)">
          &raquo;
        </a>
      </li>
    </ul>
  </nav>
</template>
