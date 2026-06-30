import type { MessageKey } from './en'

// Russian message catalog. Typed as a complete map of every MessageKey, so a
// missing or misspelled key is a compile error.
export const ru: Record<MessageKey, string> = {
  'app.name': 'LinkedIn Activity Tracker',

  'common.save': 'Сохранить',
  'common.cancel': 'Отмена',
  'common.delete': 'Удалить',
  'common.add': 'Добавить',
  'common.close': 'Закрыть',
  'common.export': 'Экспорт',
  'common.import': 'Импорт',
  'common.minutes': 'мин',
  'common.seconds': 'секунд',
  'common.loading': 'Загрузка…',
  'common.today': 'Сегодня',
  'common.done': 'Готово',

  'popup.title': 'Сегодня',
  'popup.openDashboard': 'Открыть дашборд',
  'popup.addSSI': 'Добавить SSI',
  'popup.editToday': 'Изменить сегодня',
  'popup.exportReport': 'Экспорт отчёта',
  'popup.pause': 'Приостановить учёт',
  'popup.resume': 'Возобновить учёт',
  'popup.paused': 'Учёт приостановлен',

  'events.activeTime': 'Активное время',
  'events.reaction': 'Реакции',
  'events.comment': 'Комментарии',
  'events.reply': 'Ответы',
  'events.connection_request': 'Приглашения',
  'events.message': 'Сообщения',
  'events.repost': 'Репосты',
  'events.post': 'Посты',
  'events.follow': 'Подписки',
  'events.profile_view': 'Просмотры профилей',
  'events.company_view': 'Просмотры компаний',
  'events.job_view': 'Просмотры вакансий',

  'nav.today': 'Сегодня',
  'nav.history': 'История',
  'nav.ssi': 'SSI',
  'nav.goals': 'Цели',
  'nav.privacy': 'Приватность',
  'nav.diagnostics': 'Диагностика',

  'dash.title': 'LinkedIn Activity Tracker',
  'dash.today.heading': 'Прогресс за сегодня',
  'dash.today.events': 'События',
  'dash.today.noEvents': 'За сегодня событий не зафиксировано.',
  'dash.today.manualAdjust': 'Ручная корректировка',
  'dash.today.activeTimeLabel': 'Активное время (минуты)',
  'dash.today.eventTime': 'Время',
  'dash.today.eventType': 'Тип',
  'dash.today.eventSource': 'Источник',
  'dash.source.automatic': 'авто',
  'dash.source.manual': 'вручную',

  'dash.history.heading': 'История',
  'dash.history.date': 'Дата',
  'dash.history.time': 'Время',
  'dash.history.empty': 'Истории пока нет.',

  'dash.ssi.heading': 'Social Selling Index',
  'dash.ssi.total': 'Общий SSI',
  'dash.ssi.professionalBrand': 'Создавайте профессиональный бренд',
  'dash.ssi.findRightPeople': 'Находите нужных людей',
  'dash.ssi.engageWithInsights': 'Взаимодействуйте с контентом',
  'dash.ssi.buildRelationships': 'Развивайте отношения',
  'dash.ssi.add': 'Добавить запись SSI',
  'dash.ssi.date': 'Дата',
  'dash.ssi.noData':
    'Записей SSI пока нет. Добавьте сегодняшнее значение, чтобы начать график.',
  'dash.ssi.disclaimer':
    'Активность и SSI показаны рядом. Это только визуальное сопоставление и не означает причинно-следственной связи.',

  'dash.goals.heading': 'Дневные цели',
  'dash.goals.saved': 'Цели сохранены.',
  'dash.goals.activeMinutes': 'Активные минуты',

  'dash.privacy.heading': 'Приватность',
  'dash.privacy.notice':
    'Расширение никогда не выполняет действия в LinkedIn вместо вас. Оно только фиксирует действия, которые вы вручную совершили в браузере. Все данные об активности хранятся локально на вашем устройстве.',
  'dash.privacy.whatStored': 'Что хранится',
  'dash.privacy.whatStoredBody':
    'Только метки времени, типы действий, URL без query-параметров, агрегированные счётчики, активное время и SSI, введённый вручную.',
  'dash.privacy.whatNotStored': 'Что никогда не хранится',
  'dash.privacy.whatNotStoredBody':
    'Не хранятся тексты сообщений, комментариев и постов. Нет имён, email, фотографий и содержимого профилей. Нет cookies, токенов и сетевых ответов.',
  'dash.privacy.whereStored': 'Где хранится',
  'dash.privacy.whereStoredBody':
    'Локально в вашем браузере (chrome.storage.local). Ничего не отправляется на сервер.',
  'dash.privacy.tracking': 'Переключатели трекинга',
  'dash.privacy.exportData': 'Экспортировать все данные (JSON)',
  'dash.privacy.importData': 'Импортировать данные (JSON)',
  'dash.privacy.deleteAll': 'Удалить всю историю',
  'dash.privacy.deleteAllConfirm':
    'Удалить ВСЕ данные навсегда? Это действие необратимо.',
  'dash.privacy.deleted': 'Все данные удалены.',
  'dash.privacy.storeCommentLength': 'Хранить длину комментария',
  'dash.privacy.storeCommentMeaningful': 'Хранить флаг «осмысленный» для комментариев',
  'dash.privacy.storeConnectionProfileUrl': 'Хранить URL профиля для приглашений',
  'dash.privacy.storeConnectionDisplayName': 'Хранить отображаемое имя для приглашений',

  'dash.diag.heading': 'Диагностика',
  'dash.diag.version': 'Версия расширения',
  'dash.diag.timezone': 'Часовой пояс',
  'dash.diag.selectorHealth': 'Статус трекинга',
  'dash.diag.log': 'Журнал событий',
  'dash.diag.empty': 'Записей диагностики нет.',
  'dash.diag.export': 'Экспорт диагностики',
  'dash.diag.clear': 'Очистить журнал',

  'status.working': 'Работает',
  'status.needs_verification': 'Требует проверки',
  'status.unknown': 'Неизвестно',

  'settings.idleThreshold': 'Порог простоя',
  'settings.theme': 'Тема',
  'settings.theme.system': 'Системная',
  'settings.theme.light': 'Светлая',
  'settings.theme.dark': 'Тёмная',
  'settings.language': 'Язык',
}
