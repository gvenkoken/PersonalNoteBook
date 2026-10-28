# NotDefteri

NotDefteri, aynı bilgisayarda çalışan ASP.NET Core 8 minimal API ve React +
TypeScript + Vite tek sayfalık istemci üzerine kurulan yerel not editörüdür.
Hedef ürün tek kullanıcılıdır; giriş ekranı ve kimlik doğrulama gerektirmez.
İstemcide ek UI kütüphanesi yoktur.

Depo, `ideafactra-fullstack@1` şablonunun NotDefteri adlandırılmış iskeletidir:

- `NotDefteri.sln`: tek .NET çözümü.
- `src/NotDefteri.Api/`: API, EF Core/Npgsql veri katmanı ve özellik modülleri için `Features/` dizini.
- `tests/NotDefteri.Api.Tests/`: xUnit v3 (`xunit.v3` 1.0.1), `OutputType=Exe` test projesi.
- `web/`: kök npm workspace içindeki React istemcisi ve Vitest testleri.

Gereksinimler: .NET 8 SDK, Vite 8 ile uyumlu Node.js (22.12+ veya 24 LTS),
npm ve yerel çalıştırma için PostgreSQL. Aşağıdaki komutlar depo kökünden çalıştırılır.

## Derleme ve test

Bağımlılıkları ilk kez hazırlamak için:

```sh
dotnet restore
npm install
```

Varsayılan Debug yapılandırmasında derleme ve test:

```sh
dotnet build
dotnet tests/NotDefteri.Api.Tests/bin/Debug/net8.0/NotDefteri.Api.Tests.dll
npm run build -w web
npm test -w web
```

xUnit v3 test derlemesi doğrudan çalıştırılır; ayrı test çalıştırıcısı gerekmez.
Çıktı yolu projenin varsayılan yoludur. Release kullanıldığında komutlar:

```sh
dotnet build -c Release
dotnet tests/NotDefteri.Api.Tests/bin/Release/net8.0/NotDefteri.Api.Tests.dll
```

Vitest komutu `vitest run` kullanır ve tek çalıştırmada sonlanır.
API platform testleri bellek içi SQLite kullanır. PostgreSQL testi isteğe bağlıdır:
`IDEA_TEST_POSTGRES` ortam değişkeni verilmezse atlanır. Bu değişken yalnızca
silinip yeniden oluşturulabilecek ayrı bir test veritabanını göstermelidir;
ilgili test veritabanını siler ve yeniden oluşturur.

## Docker ile çalıştırma

Uygulamanın tamamı (PostgreSQL, API ve web) tek komutla çalışır:

1. `cp .env.example .env` ve `.env` içinde `POSTGRES_PASSWORD` değerini yalnızca yerel kullanım için ayarlayın (isteğe bağlı `APP_PORT`).
2. `docker compose up -d --build`
3. http://127.0.0.1:8080 adresini (veya `APP_PORT`) açın. Web konteyneri `/api` ve `/health` isteklerini API'ye yönlendirir;
   bekleyen veritabanı migration'ları API açılırken uygulanır.

Yalnızca web portu 127.0.0.1 üzerinde yayınlanır. `docker compose down -v` konteynerleri ve veritabanı birimini siler.
Konteyner dışında API'yi compose veritabanına bağlamak için portu yerel ve commit'lenmeyen bir `compose.override.yaml`
ile açın (`services: { postgres: { ports: [ "127.0.0.1:5432:5432" ] } }`).

## Yerel çalıştırma

Yerel PostgreSQL sunucusu `localhost:5432` üzerinde çalışmalıdır. Kullanılacak
veritabanını önceden oluşturun. API bağlantı ayarını
`ConnectionStrings__AppDb` ortam değişkeninden okur. Bağlantı dizesindeki
`Host` değeri `localhost`, `Port` değeri `5432` olmalıdır; `Database` ve
gereken kimlik bilgilerini kendi yerel PostgreSQL kurulumunuza göre ayarlayın.
Bağlantı dizesini yerel terminal ortamında tanımlayın, depoya eklemeyin.

API'yi bir terminalde başlatın:

```sh
dotnet run --project src/NotDefteri.Api -- --urls http://127.0.0.1:5080
```

İstemciyi ikinci terminalde başlatın:

```sh
npm run dev -w web -- --host 127.0.0.1
```

Vite'ın terminalde gösterdiği yerel adresi açın (varsayılan
`http://127.0.0.1:5173`). Vite, `/api` ve `/health` isteklerini
`http://127.0.0.1:5080` adresine yönlendirir. `/health` API'nin canlılığını,
`/health/ready` veritabanı bağlantısının hazır olmasını kontrol eder.
İşiniz bittiğinde iki terminalde de `Ctrl+C` ile süreçleri sonlandırın.

## Mevcut kapsam ve doğrulama durumu

İstemci şu anda yalnızca API hazırlık durumunu gösterir; not düzenleme
özellikleri henüz uygulanmamıştır. API'de örnek iş özelliği modülü bulunmaz.
Şablondan kalan JWT kayıtları, test kimlik doğrulama yardımcısı ve istemci
erişim belirteci desteği hâlâ kaynak kodundadır. Bunların kaldırılması hedef
mimariye uyarlamanın kalan kısmıdır; `README.md` ve `docs/**` ile sınırlı
bu görev kapsamında kaynak kodu değiştirilemez.

AC01 durumu **Unknown** olarak kalır. Bu değişiklik sırasında bağımlılık
yükleme, derleme veya test çalıştırılmadı. AC01.1 ancak Factory'nin ayrı
sandbox ortamında derleme ve test sonuçları kaydedilince değerlendirilebilir.
