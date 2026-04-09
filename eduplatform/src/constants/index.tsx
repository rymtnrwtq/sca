import { UserTier, Lesson } from '../types';
import React from 'react';
import { Calendar, Clock, SortAsc } from 'lucide-react';

export const HIDDEN_VIDEOS_KEY = 'sca_hidden_videos';
export const FORCED_WATCHED_KEY = 'sca_forced_watched';
export const HISTORY_KEY = 'sca_watch_history';
export const WATCH_LATER_KEY = 'sca_watch_later';
export const MAX_HISTORY = 50;

export const TIER_LABELS: Record<UserTier, string> = {
  guest: 'Гость',
  free: 'Бесплатный',
  premium: 'Premium',
};

export const SECTION_META: Record<string, { label: string }> = {
  live:       { label: 'Live' },
  broadcasts: { label: 'Эфиры' },
  seminars:   { label: 'Семинары' },
  materials:  { label: 'Материалы' },
};

export const TABS = ['live', 'broadcasts', 'seminars', 'materials'] as const;

export type SortKey = 'date' | 'duration' | 'title';
export type SortDir = 'asc' | 'desc';
export type StatusFilter = 'all' | 'progress' | 'completed' | 'pinned' | 'hidden';

export const SORT_OPTIONS: { key: SortKey; label: string; icon: React.ReactNode }[] = [
  { key: 'date',       label: 'Дата',         icon: <Calendar size={13} /> },
  { key: 'duration',   label: 'Длительность', icon: <Clock size={13} /> },
  { key: 'title',      label: 'Название',     icon: <SortAsc size={13} /> },
];

export interface SeminarLink {
  title: string;
  url: string;
}

export interface CatalogItem {
  id?: string;           // Kinescope folder ID
  projectId?: string;    // Kinescope project ID (if different from default)
  videoIds?: string[];   // specific Kinescope video IDs (playlist mode)
  externalUrl?: string;  // external link (opens in new tab, no video viewer)
  trainingPlanId?: string; // key in TRAINING_PLANS (inline training plan viewer)
  links?: SeminarLink[]; // list of external links (Drive/Docs materials)
  title: string;
  description: string;
  videoCount?: number;
}

export const SCA_SEMINARS: CatalogItem[] = [
  { id: '811cf673-5612-49a9-938b-316660a6c728', title: 'Обратная сторона успеха 2023', description: 'Первый семинар SCA. 5–8 сентября 2023. Международный семинар с топ-лекторами из СНГ. Теория + практика, максимум общения и обмена опытом.', videoCount: 28 },
  { id: '42fe4afa-af7b-4aca-aaeb-26dcf5401cd7', title: 'Плавание без границ', description: 'Теория + круглый стол. Максимум общения и обмена опытом. Новый формат, где слушатели и специалисты решают задачи вместе.', videoCount: 14 },
  { id: '93ee737c-bd18-40f4-949e-90293a274869', title: 'Плавание для всех: как полюбить воду', description: '11–13 апреля 2024. Начальная подготовка. Мастер-классы и интерактивные лекции. Острые темы от лучших спикеров СНГ.', videoCount: 16 },
  { id: '3a53098a-abdd-4af3-9546-bf421cfe7876', title: 'Начальная подготовка: шаг за шагом к успеху', description: 'Астана, май 2024. Про начальную подготовку от тренеров, психологов и родителей.', videoCount: 12 },
  { id: '6d99f65c-0026-4ef8-add2-d215f2ef4bbc', title: 'Обратная сторона успеха 2024', description: '4–6 ноября 2024. Высшее мастерство. Лекторы — тренеры Олимпийских чемпионов, одни из лучших в мире.', videoCount: 24 },
  { id: '96fd659b-31f9-4235-92f3-9d4975ac887b', title: 'ПЛАВАНИЕ 2.0. Фундамент для будущих чемпионов', description: 'Сэкономьте 10 лет карьеры, переняв опыт лучших специалистов со всего мира на главной конференции о плавании.', videoCount: 20 },
  { id: 'ef4601b6-d9ac-4a64-937d-62c5cd40fcab', title: 'Разрыв шаблонов', description: '400 спортсменов из 5 стран мира в одном онлайн-мероприятии.', videoCount: 8 },
];

export const FOREIGN_SEMINARS: CatalogItem[] = [
  { id: 'd1f38a94-6ad2-4c56-a698-58d06b6ab55d', title: 'Первая европейская тренерская конференция LEN', description: 'Профессиональное собрание высокого уровня. Методологическое мастерство от элитных тренеров и учёных, которые определяют успех в олимпийском спорте.', videoCount: 11 },
  { id: '11e3766e-c5c2-4788-9944-7996c3a98ba5', title: 'Конференция Learn To Swim 2023', description: 'Международная конференция по обучению плаванию для специалистов. Переведена на русский язык.', videoCount: 9 },
  { id: '3997c141-ca84-42f0-80d5-248b0ff53af4', title: 'FINA Golden Coaches Clinic 2016', description: 'Официальный семинар от международной федерации плавания World Aquatics (бывшая FINA).', videoCount: 26 },
  { id: '3e44ab35-5d10-4ef0-965d-4af4c8e006f6', title: 'FINA Golden Coaches Clinic 2018', description: 'Официальный семинар от международной федерации плавания World Aquatics. 2018 год.', videoCount: 24 },
  { id: '0e879e60-6ba3-4133-8770-284cd1430cda', title: 'Тренерская конференция в Форт-Лодердейле (США)', description: 'Встреча специалистов в области спорта. Лекции от ведущих экспертов, обмен опытом и современные методики развития.', videoCount: 19 },
];

export const OTHER_SEMINARS: CatalogItem[] = [
  { id: '8bcfe092-8ee6-40ab-b771-bad8c8d6c58c', title: 'Серия выступлений Дэвида Марша', description: 'Qazaq Aquatic семинар с американским тренером. Лекции от одного из ведущих тренеров США.', videoCount: 5 },
  { id: '1c36282e-f1ca-4898-9aed-dab923229089', title: 'Семинар Aqua Fest', description: 'Семинар по плаванию AQUA FEST 28–29 августа 2025 года.', videoCount: 7 },
  { id: '3afd0464-84f1-47a9-9ab2-c27dd721bd66', title: 'Сборник конференций и семинаров ВФП', description: 'Доступ к записям, материалам и ключевым выводам мероприятий, посвящённых развитию плавания в России.', videoCount: 17 },
  { id: 'a327668d-16d7-4494-873b-d2de9291868f', title: 'Материалы Европейской федерации плавания LEN', description: 'Доступ к записям от лучших тренеров Европы и мира. Лекции для тренеров и спортсменов.', videoCount: 10 },
  { id: '0971e5ce-d33b-4f39-a30b-525a61913916', title: 'Семинар при поддержке НОК Беларуси 2023', description: 'Семинар для тренеров по плаванию при поддержке Национального Олимпийского Комитета Беларуси.', videoCount: 7 },
  { id: '4cb0cd5d-c2d5-46c2-8b3f-9e00b6f2206c', projectId: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', title: 'Онлайн конференция по психологии', description: 'Онлайн конференция спортивной психологии для родителей и спортсменов.', videoCount: 12 },
];

export interface MaterialCategory {
  key: string;
  label: string;
  items: CatalogItem[];
}

export const MATERIALS_CATALOG: MaterialCategory[] = [
  {
    key: 'technique',
    label: 'Техника и навыки',
    items: [
      { id: 'c9a70dfe-0d7c-4f56-a497-5b83d4c8c56e', title: 'Конструкция подводки от Александра Осипенко', description: 'Мастерство выполнения подводной фазы и подхода к старту/повороту.', videoCount: 7 },
      { id: 'bc609c6c-ec3b-4d17-ba29-13272d17d5e6', title: 'Серия видео Калеба Дрессела (RU)', description: 'Разбор техники вместе с 9-кратным Олимпийским чемпионом. Серия видео от Калеба Дрессела на русском языке.', videoCount: 6 },
      { id: '8cd09764-3024-473c-818d-364f933b952d', title: 'Серия видео Калеба Дрессела (EN)', description: 'Оригинальная серия видео от Калеба Дрессела на английском языке.', videoCount: 6 },
      { id: 'ab26964f-976f-4e91-b1c4-026366f5546b', title: 'Образовательные материалы GRC', description: 'Разработки и методики от Glenn Mills и команды GRC.', videoCount: 6 },
      { videoIds: ['dpiA6zUTA8UNuxpMJE3MP6', '8gtzHL3xHJfqxJVWLPTYzG'], title: 'Мастер-класс рекордсмена мира Егора Корнева', description: 'Техника плавания от рекордсмена мира. Разбор части на воде и на суше.', videoCount: 2 },
    ],
  },
  {
    key: 'training',
    label: 'Тренировки и упражнения',
    items: [
      { id: '363f704b-e3e5-4797-8fde-aef816233c32', projectId: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', title: 'ОФП на суше с Постовым А.И.', description: 'Упражнения для развития силы и выносливости вне воды.', videoCount: 15 },
      { id: 'ffe93a8c-9170-45af-846b-d47b92b84ada', title: 'Комплексы упражнений от Александра Чиркина', description: 'Комплексы упражнений базового уровня на суше и в воде от тренера Александра Чиркина.', videoCount: 2 },
      { id: '08eb9bc1-c3e4-4868-887a-5754b2e27eac', title: 'Лекции Александра Манкевича', description: 'Тактика и методика подготовки пловцов. Лекции из СК Альбатрос, Волгоград.', videoCount: 23 },
      { videoIds: ['jfNrEKt4228C3iHQiYjzDp', 'nXD75RpCS7wskURscXVTH4'], title: 'Выездной мастер-класс Яськевич Ольги', description: 'Работа с группой на выезде: тренировка в зале и тренировка на воде.', videoCount: 2 },
    ],
  },
  {
    key: 'masterclass',
    label: 'Мастер-классы тренеров',
    items: [
      { id: 'ef1fc503-fb65-45a9-85a5-e9f866f63c90', title: 'Мастер-классы в Ниагара Фитнес', description: 'Опыт и подходы к подготовке спортсменов. Выездные мастер-классы ведущих тренеров.', videoCount: 23 },
      { id: '782701d7-e44f-4388-84b7-b1984fdc7237', projectId: '998ad1d1-b0a1-47e1-aa40-58a295fb142e', title: 'Комплексный подход Тодда ДеСорбо', description: 'Тренировки по спринтерскому вольному стилю от тренера Олимпийских чемпионов.', videoCount: 2 },
    ],
  },
  {
    key: 'science',
    label: 'Научно-образовательные',
    items: [
      { id: 'fed6e3d1-0c0c-4341-a4c0-2e675ec3b3f8', projectId: '75a3101e-c447-40bf-9dac-62c5cd40fcab', title: 'Курс по психологии от Мулярчик', description: 'Эффективные методы мотивации, работа с подростками, переходный возраст в спорте.', videoCount: 9 },
      { videoIds: ['knH1aKbitsov7dnBhpU8ts', '0ADWnGw3FKr6beGhedZ8u7', '4pG5DLf1Sqq8U5a9KkZHFk', 'g12QpPK32uxydi11jano3z', '2eRWsCvLqx5VqVapm91JNj', 'wY615ttAFSPPAzWWoiN8Jm', 'cZzUWBZ4DP5gCoKitEeBmj', '2a4UqQCMLhXGJeuz8frFVo', 'oDknMJ5ncvMPVQAYPbHgbW'], title: 'Курс по психологии «Пульт управления мозгом»', description: 'Курс спортивной психологии. Постановка целей, управление эмоциями, оптимальное боевое состояние и работа со страхом соревнований.', videoCount: 9 },
      { videoIds: ['a3NuVnyUS7mTcSakNn8eUf', '9u3rYoBTHuSSGtJtJVahe5', 'rxVTfpJZPfR3aJrnnRJ9AG', 'gSERBZtmqtQMtX7k2fbjoF', '0X1AaczsbhqJhTrgPVKSDo', 'pcCY99YmADry2MzRcPfp25', 'eikHcoecr8XxT9TE9BamP9', 'qXntcCpvtD32rn6ixhwgcw', 't27E7uDcZYr3x3wEqbyZfH', 'vFo7ZrHBcsXgN7GYF77AFB', '9rdPviRDa8TsfRBk66rXKn', 'pgiFbJYHbgCjkDCAM7r7sT', '7tbdw7bmganngrHvtjLLGs', 'kFJWMad5idnvyxnVbQdMSQ', 'oWUu3EoEq1bgkNPsnrne6R'], title: 'Сборник от Белорусского ГУФК', description: 'Конференции и лекции от Белорусского государственного университета физической культуры.', videoCount: 15 },
      { id: '2ea20880-0c9f-4044-8d97-1cd1018d4e5e', projectId: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', title: 'Образовательные материалы Aqualibrium', description: 'Школа плавания и фридайвинга. Курс по методике Total Immersion и открытой воде.', videoCount: 10 },
      { videoIds: ['rL1PJeB4hQE21RMh9qFVaT', 'dVtkFgo4WvFvBPETW8bb9K', 'g5fJZpjVSdHPPE1G2Hku8r', 'e3CNvA46tab6C11sq1F7Hr', '6VmZrBuV95Rjed6JSL68F1', '3GjmAykpjupdVLMRoZjsjL', '7KsEgCVSNzAJhCAm987ycY'], title: 'Подборка от WORLD AQUATICS (RU)', description: 'Официальные материалы международной федерации. Разборы лучших пловцов и соревнований 2024–2025.', videoCount: 7 },
    ],
  },
  {
    key: 'international',
    label: 'Международные школы',
    items: [
      { videoIds: ['bBqRtEk3yqaKvmcgUtYgBV', 'j8Lgy3Xz6CwkFnVjakX8pv', '5fX65f8SiYgcFczkUeaTtW', '6GFPGaCarPNJWzh7Lebo6B', '3W1vftRfdJdJEd2F9CCfp7', 'hpeFTdGR1WrpeH7SGZg4L9', 'vJ2k24H8ZBdtEsorrKxare', '7rgrXWFJXDT3d9RoSBBigU', 'tB5GbjF3kh5nRTysaGspmC', 'oM6TxcEvUWBXBvBSYvxKst', 'nQUkgdpRLv87cDtSrkVogv', '8gweCLuneCmth1ntMg8VPD', 'h9sqm6CYoLdMUwp3FL4Vby', '86KvTHuRH1Bd8JhbRzp4nj', 'csxWQEfPd8Vq1vaANAeAn6', '6pTLNnRhqQS6J52xFNUFh4', 'ptuawn6ktmq1yxG67Rbz8T', 'cjbbncbGRSFizMBp5BE3wr', 'k885qi9N4gdQdyZBaGvSLc', '2eSmiwSFD2CXxz2rEmbcDz', 'tEtbfHqNb1UE5DSgXMNdt4', 'skLXwpFxWphg1bsFH8HFYN', 'acLpmtsxRLfzetrT5cY76S', '9FMwQzdZ4RwijrRN3pRCKA', '9kXKCiekMBZc7M8DfTKc13', 'cRK1DHqA8fMt1hufMDvinG', '4dc1kPMbiMbfEhvDZFNMZP', 'tm5EPQDY2imXBgdoM3asbk', 'symCXNbfrZQgjg5hEndtiD', 'f7mW36BaDfkTFXhq6o9WFm', 'a5CfCZiZHkk4H74vvmaeSu', 'gzYtc5EoPHQh9KjMiKFxHZ', 'vEvDBPmAAwzyFU2aBb1J6A', '8wPZcAExzPtTeNi2Px1S91', 'mpWNomGawSJLJk1dQ2UrNc', 'uNwAceupcPGQEtu5eXW1a7', 'mcMtPQNkm31Z971VuRNVWi', 'w4qCwpT2C7RNqRaDzpVRyB', 'ka8Wtvn2quH1MVFcepq3W4', 's8F6XuvMF3BNvAr2XATQEB', 'iPVyB4hv3cFHAe2Atj9nP2', 'rxRtG1MkBue7up8DxRZbRv', 'rnQMU69o8iMdszRFqrLUJL', 'wY2UhR5G7jngbv25HusVKV', 'hiQqvDpLN89XTBCdgwcogM', '4AZ8thb7bf7AeurN7Z21uK', 'f9cSNGFaT8juwyJHhTiTqS', 'miNPaqmx6zENShtcTNGPZc', 'wtYZyButiYUNpGD7bEV5zr', 'qb66EhEe8SsyhJcn4PwPj3', 'pxZv1C7jbZkH3TRyC472LF', 'ucCqPDYLWNcmV7VUudh3XM', '5cnsS5yLTLN5SKWDKLQFyd', '8mcs1818zfg2gdxMzreDGu'], title: 'The Race Club: Кроль', description: 'Техника вольного стиля от The Race Club. Разбор фристайла, гибридного кроля, подводных упражнений и тактики гонки.', videoCount: 54 },
      { videoIds: ['bAp4N73GsXB9CHTgdNswFd', 'jMaE6Z9tq95sDk3rbwis5A', 'wqGe3ZKTUeHRAjhKRkNEjh', '2VLurn7MAUUNUARZUgmatQ', '77ec78twJwHyePuF3dFic8', 'pVJMTy5Jju9FEGL3zCbDm4', 'mnKt5AQFh5XCJW227sx1fP', 'fH6U7s7dNWVSZG9AWPQoN7', 'v7HK4zjeQmTXMxUTrFzUph', 'wLen4JFYP4u1yxN8joBFJf', '5wGkczFuooW9Wf66SFcKDc', 'pkkYMcdaxqvC8CyaHvXkHy', 'nnUGXGqUbGemGdwrFAWGzB', 'opZ3GvP7RtNAKevdyKqa6K', 'rRSxkqRaZh4ddL6LbGUbqA', '2gMHtr6ALPFKvhaFfJnd6L', '9UPueJbh8eMiw4qMN3yVid', 'gwyKRiRTUAN2eAbfz29iba', 'xxSFiQjq83HUyaFPiGFo6L', 'uyTuho1J4sfYTXngiuc4EH', '3KCFSgEGD3kv9bL5o23JrY', 't8bSXcaVUTVQTRYF5U4WrB', 'etChFfEaVZps3SEjji1LXD'], title: 'The Race Club: Спина', description: 'Техника плавания на спине от The Race Club. Упражнения, положение тела, разбор поворотов и финишного удара.', videoCount: 23 },
      { videoIds: ['564Pq6ih2Lti14cSN46NBt', 'ba117SAnCtv6pD4SbCCmts', 'bKrsWD8jdgXh2U73q6e9en', 'u9SoQgDuBRUMKWVfSY5s5f', 'tE43NMUPVcBGc2NxL9Vdi9', 'nTU6RqDQVz2XywWRvnt1uN', 'bE1Ltn3rGeFz1wZwYU4QfN', 'n416NLyTDXwoGkaocVJnhT', 'i2PGqGRmPQQaiXxVsUFvHi', 'wqtakJvLwyKxP4QYLo5wBW', 'bwyioHUAfpX5mtfyy5WaUt', 'deq7QnHAbdyEGu7vtBBE2W', 'eSFC8bV6iEWYFVMhpVnaiV', 'sf2wsGAGCB4Zd15sDGAN2W', '7AtcoTgdRFF7P943PQ2VDi', '16edMh3Lau6TuJpMo66Uno', 'hiULaNtYchgdtdEfNLprAp', '8pjfz63XNwYTaLoCJVuGME', 'iQpDWqVd89qiEUFhFc6Kou', 'bds9vnSfLyKjUGUtMTAQQW', 'aZ2GoHkzK8sdGWW1GT1boQ', 'fMpb1ofb6esSx1c5LVQQXE', 'kRF5SHVdNNijwmToNAtsg5', 'aankcsXSwV2aabFvTWHCAF', '8iyQ6EaVMLo41VScWG9Rkx', 'b2PWBhXAWpwyLYJ4wTefwJ', 'uabGGzCkLoGPJH1hfjTgMt', '9ekHaauemCxfJL4Q5HJvGS', '7kV7XEmbK2w1kntXMjvoiJ', 'aPHBbn1pKSYDqKT7hPLhqf', 'uD1fyFLwbPzkthkNSKM1bW', 'tWHsfhFtnMADWsL7HMAW7c', '54h5R3GhBUiU9Wdh88hQ85', 'srSCqtdLSim6GARuYi37UY', '9BhdGMJc8sG8hVJvd2nzSp', '9oJVosQZZbrDWJ3LpTx9co', '3vNU2Kx3Ujn3ERHMBM2cSD', 'oiUd75mot8hJXpy2EygA84', 'q9Uf9hQXEP9PacEeuiFmY2', '4TcDCVw8ZahnVGtRoUYuT2', 'okSHRKtsEamKme7wLdhmWr', '0QbkQsZNUjaGxap6V1p9bL', 'anzV2QvNKMXt9HSsdM9c8A', 'ttUszhBCt4iYZdx5veGf4b'], title: 'The Race Club: Брасс', description: 'Техника брасса от The Race Club. Упражнения на пуллаут, гребок, толчок ногами и технику поворота.', videoCount: 44 },
    ],
  },
  {
    key: 'motivation',
    label: 'Личности и мотивация',
    items: [
      { id: '4cb0cd5d-c2d5-46c2-8b3f-9e00b6f2206c', projectId: '75a3101e-c447-40bf-9dac-6ab66d06cfe9', title: 'Семинар «Воспитай Чемпиона»', description: 'Ценности, привычки и методы подготовки спортсменов мирового уровня.', videoCount: 12 },
      { id: '70a805db-2189-43c9-ba25-e87ff22af4de', projectId: '998ad1d1-b0a1-47e1-aa40-58a295fb142e', title: 'Материалы WORLD AQUATICS', description: 'Успех олимпийских чемпионов: Сара Сьёстрём, Адам Пити, Давид Попович — рассказы их тренеров.', videoCount: 7 },
      { videoIds: ['53M9ePEDAoCN3FGTzCs8Z3', '3ADSKcLdffYdFH7UKGagZm', '5WT7ATTW7GDgZntSJi5VLA', '6rswEoFtoPrsXu84mxugJ9', 'tkhXKFG7JrfKdUsGJG5kY7', 't3751GPkdDuzjPX47v25tb', 'tJ2eQ74nTMms3WWe3dM1g4', 'mkkQvkmegsLvN82XFRtkfe'], title: 'Интервью с Бобом Боуманом', description: 'Серия интервью с тренером Майкла Фелпса. Характеристики чемпионов и секреты подготовки к Олимпийским играм.', videoCount: 8 },
      { videoIds: ['tHXRo8xxNFYwXKBQ72TbX6', 'vQ9vAqWUykCH3XGUqJSPce'], title: 'Лекция Адриана Радулеску «Успех Давида Поповича в Париже-2024»', description: 'Разбор победного выступления Давида Поповича тренером Адрианом Радулеску. Доступна на русском и английском языках.', videoCount: 2 },
    ],
  },
  {
    key: 'judging',
    label: 'Судейство',
    items: [
      { videoIds: ['h9kij1ZyXn6GSr5mYkqJvP'], title: 'Курс для судей по открытой воде', description: 'Семинар по судейству в плавании на открытой воде для действующих и начинающих судей.', videoCount: 1 },
      { videoIds: ['duDrMUUrb7Yy3G1x6g3SJd'], title: 'Семинар по судейству в плавании', description: 'Разбор правил и практики судейства в плавании. Для действующих и начинающих судей.', videoCount: 1 },
      { externalUrl: 'https://docs.google.com/presentation/d/1fl97sufx33vBEoF5F3UZjSMC0ql5gc7c/edit?slide=id.p1#slide=id.p1', title: 'Презентация: Семинар по судейству в плавании', description: 'Слайды к семинару по судейству в плавании. Открывается в Google Slides.' },
    ],
  },
];
