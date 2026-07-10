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
  'events.connection_request': 'Коннекты',
  'events.message': 'Сообщения',
  'events.repost': 'Репосты',
  'events.post': 'Посты',
  'events.follow': 'Подписки',
  'events.profile_view': 'Просмотры профилей',
  'events.company_view': 'Просмотры компаний',
  'events.job_view': 'Просмотры вакансий',

  'nav.today': 'Сегодня',
  'nav.history': 'История',
  'nav.ssi': 'Аналитика',
  'nav.goals': 'Дневные цели',
  'nav.privacy': 'Приватность',
  'nav.diagnostics': 'Диагностика',

  'dash.title': 'LinkedIn Activity Tracker',
  'dash.header.trackingActive': 'Учёт активен',
  'dash.today.heading': 'Прогресс за сегодня',
  'dash.today.subtitle': 'Короткая сводка по видимой активности LinkedIn за день.',
  'dash.today.goal.done': 'Готово',
  'dash.today.capture.heading': 'Записать метрики LinkedIn за сегодня',
  'dash.today.capture.body':
    'Откройте эти страницы LinkedIn один раз за день, чтобы расширение сохранило свежую аналитику локально.',
  'dash.today.capture.open': 'Открыть',
  'dash.today.capture.recorded': 'Записано',
  'dash.today.activeTimeLabel': 'Активное время (минуты)',
  'dash.history.heading': 'История',
  'dash.history.date': 'Дата',
  'dash.history.time': 'Время',
  'dash.history.empty': 'Истории пока нет.',
  'dash.history.actionsCount': 'Действий: {count}',
  'dash.history.less': 'Меньше',
  'dash.history.more': 'Больше',
  'dash.history.profileViewers': 'Просмотры',
  'dash.history.postImpressions': 'Показы',
  'dash.history.followers': 'Подписчики',
  'dash.history.searchAppearances': 'Поиск',

  'dash.ssi.heading': 'Social Selling Index',
  'dash.ssi.total': 'Общий SSI',
  'dash.ssi.professionalBrand': 'Создавайте профессиональный бренд',
  'dash.ssi.findRightPeople': 'Находите нужных людей',
  'dash.ssi.engageWithInsights': 'Взаимодействуйте с контентом',
  'dash.ssi.buildRelationships': 'Развивайте отношения',
  'dash.ssi.add': 'Добавить запись SSI',
  'dash.ssi.history': 'История наблюдений',
  'dash.ssi.date': 'Дата',
  'dash.ssi.noData':
    'Записей SSI пока нет. Откройте linkedin.com/sales/ssi, чтобы расширение записало данные.',
  'dash.ssi.disclaimer':
    'Активность и SSI показаны рядом. Это только визуальное сопоставление и не означает причинно-следственной связи.',
  'dash.views.heading': 'Просмотры профиля',
  'dash.views.viewers': 'Просмотревшие',
  'dash.views.rangeDays': 'Период (дней)',
  'dash.views.noData':
    'Записей пока нет. Откройте «Кто просматривал ваш профиль» в LinkedIn, чтобы записать сегодняшнее значение.',

  'dash.linkedinDashboard.heading': 'LinkedIn dashboard',
  'dash.linkedinDashboard.postImpressions': 'Показы постов',
  'dash.linkedinDashboard.postImpressionsRangeDays': 'Период показов (дней)',
  'dash.linkedinDashboard.followers': 'Всего подписчиков',
  'dash.linkedinDashboard.followersChangePercent': 'Изменение подписчиков (%)',
  'dash.linkedinDashboard.profileViewers': 'Просмотры профиля',
  'dash.linkedinDashboard.profileViewersRangeDays': 'Период просмотров (дней)',
  'dash.linkedinDashboard.searchAppearances': 'Появления в поиске',
  'dash.linkedinDashboard.searchAppearancesPeriod': 'Период поиска',
  'dash.linkedinDashboard.searchAppearancesChangePercent': 'Изменение поиска (%)',
  'dash.linkedinDashboard.weeklyPosts': 'Посты за неделю',
  'dash.linkedinDashboard.weeklyComments': 'Комментарии за неделю',
  'dash.linkedinDashboard.weeklyPeriod': 'Недельный период',
  'dash.linkedinDashboard.noData':
    'Записей пока нет. Откройте linkedin.com/dashboard/, чтобы записать агрегированные метрики dashboard.',

  'dash.goals.heading': 'Дневные цели',
  'dash.goals.subtitle':
    'Задайте дневную норму для каждого действия — прогресс виден на вкладке «Сегодня».',
  'dash.goals.saved': 'Цели сохранены.',
  'dash.goals.todayCount': 'Сегодня: {count}',
  'dash.goals.offHint': 'Выключено — не входит в дневную цель',
  'dash.goals.total': 'Всего действий в день',
  'dash.goals.unsaved': 'Есть несохранённые изменения',
  'dash.goals.revert': 'Вернуть',
  'dash.goals.decrease': 'Уменьшить: {label}',
  'dash.goals.increase': 'Увеличить: {label}',

  'dash.privacy.heading': 'Приватность',
  'dash.privacy.notice':
    'Расширение никогда не выполняет действия в LinkedIn вместо вас. Оно только фиксирует действия, которые вы вручную совершили в браузере. Все данные об активности хранятся локально на вашем устройстве.',
  'dash.privacy.heroTitle': 'Локально по умолчанию. Данные принадлежат вам.',
  'dash.privacy.heroBody':
    'LinkedIn Activity Tracker работает в вашем браузере, хранит данные в локальном хранилище Chrome и не отправляет вашу активность на серверы. Расширение open source, поэтому код можно проверить.',
  'dash.privacy.sourceCode': 'Открыть исходный код',
  'dash.privacy.safety': 'Безопасно для аккаунта',
  'dash.privacy.safetyBody':
    'Расширение не совершает действий в LinkedIn от вашего лица и ничего не автоматизирует — никаких автолайков, автосообщений и автоприглашений. Оно только записывает вашу собственную активность, чтобы потом можно было понять, почему SSI растёт или не растёт.',
  'dash.privacy.whatStored': 'Что хранится',
  'dash.privacy.whatStoredBody':
    'Метки времени, типы действий, URL без query-параметров, агрегированные счётчики, активное время, значения SSI, суммарные просмотры профиля, агрегированные метрики dashboard и опциональные локальные детали вроде длины комментария и данных профиля для приглашений.',
  'dash.privacy.whatNotStored': 'Что никогда не хранится',
  'dash.privacy.whatNotStoredBody':
    'Не хранятся тексты сообщений, комментариев и постов. Нет email, фотографий, содержимого профилей, cookies, токенов и сетевых ответов.',
  'dash.privacy.whereStored': 'Где хранится',
  'dash.privacy.whereStoredBody':
    'Только локально в вашем браузере (chrome.storage.local). Нет backend-аккаунта, синхронизации или отправки аналитики с вашей активностью.',
  'dash.privacy.openSource': 'Open source',
  'dash.privacy.openSourceBody':
    'Исходный код расширения публичный, его можно проверить на',
  'dash.privacy.tracking': 'Переключатели трекинга',
  'dash.privacy.exportData': 'Экспортировать все данные (JSON)',
  'dash.privacy.importData': 'Импортировать данные (JSON)',
  'dash.privacy.deleteAll': 'Удалить всю историю',
  'dash.privacy.deleteAllConfirm':
    'Удалить ВСЕ данные навсегда? Это действие необратимо.',
  'dash.privacy.deleted': 'Все данные удалены.',
  'dash.privacy.storeCommentLength': 'Хранить длину комментария',
  'dash.privacy.storeCommentLengthHint':
    'По умолчанию включено, чтобы позже можно было оценить усилие по комментариям. Сам текст не хранится.',
  'dash.privacy.storeCommentMeaningful': 'Хранить флаг «осмысленный» для комментариев',
  'dash.privacy.storeCommentMeaningfulHint':
    'Хранит только флаг да/нет по длине комментария, без текста комментария.',
  'dash.privacy.storeConnectionProfileUrl': 'Хранить URL профиля для приглашений',
  'dash.privacy.storeConnectionProfileUrlHint':
    'По умолчанию включено для детальной локальной истории приглашений. Можно выключить, если нужны только агрегаты.',
  'dash.privacy.storeConnectionDisplayName': 'Хранить отображаемое имя для приглашений',
  'dash.privacy.storeConnectionDisplayNameHint':
    'По умолчанию включено, чтобы история приглашений оставалась узнаваемой локально. Можно выключить, если не хотите хранить имена.',

  'dash.diag.heading': 'Диагностика',
  'dash.diag.version': 'Версия расширения',
  'dash.diag.timezone': 'Часовой пояс',
  'dash.diag.selectorHealth': 'Статус трекинга',
  'dash.diag.allWorking': 'Все детекторы работают',
  'dash.diag.lastCheck': 'последняя проверка',
  'dash.diag.issues': 'Некоторые детекторы требуют внимания',
  'dash.diag.noHealthData': 'Проверок детекторов пока не было.',
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

  'toast.ssiRecorded': 'SSI записан: {total}',
  'toast.profileViewsRecorded': 'Просмотры профиля записаны: {viewers}',
  'toast.linkedInDashboardRecorded': 'LinkedIn dashboard записан',
}
