import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="ie-foot">
      <div className="ie-wrap">
        <div className="ie-foot-grid">
          <div>
            <h4>Ignatev Estate</h4>
            <p>
              Платформа проверенных и надёжных новостроек Пхукета и Юго-Восточной Азии: цены, этапы
              стройки и наличие лотов обновляются застройщиками, проверка проектов ведётся независимым
              реестром.
            </p>
            <p>
              Ignatev Estate Co., Ltd
              <br />
              115 Cherngtalay Office, Plaza Del Mar.1, 116 Pasak-Koktanod Rd, Phuket 83000
              <br />
              +66 92 240 7355
            </p>
          </div>
          <div>
            <h4>Покупателям</h4>
            <Link href="/">Каталог новостроек</Link>
            <Link href="/developers">Застройщики</Link>
            <Link href="/market?tab=analytics">Аналитика рынка</Link>
            <Link href="/market?tab=calc">Калькулятор доходности</Link>
            <Link href="/market?tab=shortlist">Шорт-лист</Link>
          </div>
          <div>
            <h4>Знания</h4>
            <Link href="/guide">Гид по покупке</Link>
            <Link href="/guide/kak-kupit-nedvizhimost-na-phukete">Как купить на Пхукете</Link>
            <Link href="/guide/rajony-phukety">Районы Пхукета</Link>
            <Link href="/guide/riski-i-proverka-zastrojshchika">Риски и проверка</Link>
          </div>
          <div>
            <h4>Защита прав</h4>
            <Link href="/protection">О защите прав инвесторов</Link>
            <Link href="/protection/problems">Острые проблемы</Link>
            <Link href="/protection/how-it-works">Как это работает</Link>
            <Link href="/protection/contact">Обратиться за помощью</Link>
            <Link href="/protection/representative">Уполномоченный представитель</Link>
          </div>
          <div>
            <h4>Платформа</h4>
            <Link href="/registry">Реестр проверки</Link>
            <Link href="/partner">Кабинет застройщика</Link>
            <Link href="/login">Вход</Link>
            <Link href="/privacy">Конфиденциальность</Link>
          </div>
        </div>
        <p className="ie-foot-legal">
          Информация носит справочный характер и не является инвестиционной или юридической консультацией.
          Любая сделка требует самостоятельной проверки и независимого юридического сопровождения.
          Статус проверки каждого проекта указан на его карточке: «заявлено» означает, что данные
          предоставил застройщик и реестр их ещё не проверял.
        </p>
      </div>
    </footer>
  );
}
