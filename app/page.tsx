import Navbar from "../components/Navbar";
import Hero from "../components/Hero";
import FeaturedProducts from "../components/FeaturedProducts";
import Offers from "../components/Offers";
import Categories from "../components/Categories";
import HomeCollections from "../components/HomeCollections";
import Footer from "../components/Footer";

export default function Home() {
  return (
    <>
      <Navbar />

      <main>
        <Hero />

        <Offers />

        <Categories />

        <HomeCollections />

        <FeaturedProducts />
      </main>

      <Footer />
    </>
  );
}
